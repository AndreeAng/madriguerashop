"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreOwnerIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { rateLimit, getClientIp, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { normalizePhoneBO, PHONE_BO_RE } from "@/lib/auth/identifiers";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { EMAIL_RE } from "@/lib/validation/email";
import { buildWhatsAppUrl } from "@/lib/utils";
import { INVALID_INPUT_ERROR } from "@/lib/validation/actionState";
import { getAvailableSlots } from "@/lib/booking/slots";
import { ymdLocal } from "@/lib/i18n/dates";

export type CreateBookingState = {
  ok?: { trackingToken: string; whatsappUrl: string };
  error?: string;
  fieldErrors?: Partial<
    Record<"customerName" | "customerPhone" | "customerEmail" | "startsAt", string>
  >;
};

// `PHONE_BO_RE` exportada desde `lib/auth/identifiers` — fuente única.

const createSchema = z.object({
  productId: z.string().min(1),
  storeSlug: z.string().min(1),
  startsAt: z.string().min(1, "Elige un horario"),
  customerName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(80),
  customerPhone: z
    .string()
    .trim()
    .refine(
      (v) => PHONE_BO_RE.test(v.replace(/[\s-]/g, "")),
      "Teléfono inválido. Formato: +591XXXXXXXX",
    ),
  customerEmail: z
    .string()
    .trim()
    .max(120)
    .refine(
      (v) => v === "" || EMAIL_RE.test(v),
      "Email inválido",
    )
    .optional()
    .default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ============== Crear reserva (cliente público) ==============

export async function createBookingAction(
  _prev: CreateBookingState,
  formData: FormData,
): Promise<CreateBookingState> {
  // Rate limit: 5 reservas / 10 min por IP. Sin esto un bot podría
  // bombardear el calendario con slots fake hasta dejarlo sin huecos.
  const ip = await getClientIp();
  const rl = await rateLimit(`booking:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
  }

  const parsed = createSchema.safeParse({
    productId: formData.get("productId"),
    storeSlug: formData.get("storeSlug"),
    startsAt: formData.get("startsAt"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<CreateBookingState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  const startsAt = new Date(data.startsAt);
  if (!Number.isFinite(startsAt.getTime())) {
    return { fieldErrors: { startsAt: "Horario inválido" } };
  }
  const now = new Date();
  if (startsAt <= now) {
    return { fieldErrors: { startsAt: "El horario debe ser futuro." } };
  }
  // Cap a 90 días: sin esto, un bot podría reservar todos los slots de
  // los próximos 5 años y colapsar el calendario del owner. 90 días es
  // razonable: ningún cliente real reserva un servicio con tanta
  // antelación, y el owner puede cambiar el cap si lo necesita.
  const MAX_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
  if (startsAt.getTime() - now.getTime() > MAX_HORIZON_MS) {
    return {
      fieldErrors: {
        startsAt: "Solo se pueden reservar horarios dentro de los próximos 90 días.",
      },
    };
  }

  // Filtramos por `store.slug` además de `id` para evitar que un cliente
  // de la tienda X envíe el `productId` de la tienda Y y cree una reserva
  // cross-tenant en un servicio que esa tienda nunca expuso en ese slug.
  // El filtro `store.is: { slug }` no exige saber el storeId en el cliente.
  const product = await db.product.findFirst({
    where: {
      id: data.productId,
      isActive: true,
      isBookable: true,
      store: { slug: data.storeSlug },
    },
    select: {
      id: true,
      name: true,
      storeId: true,
      isActive: true,
      isBookable: true,
      bookingDurationMin: true,
      bookingBufferMin: true,
      store: { select: { slug: true, name: true, whatsappPhone: true } },
    },
  });
  if (!product) {
    return { error: "Este servicio no acepta reservas en este momento." };
  }

  // El slot elegido DEBE ser uno de los que la grilla pública genera para
  // ese día (getAvailableSlots): dentro del horario de atención, alineado
  // al paso duración+buffer, futuro y sin cruces. Sin esta re-validación,
  // el server aceptaba cualquier `startsAt` del FormData — un request
  // manual podía reservar a las 03:00 con la tienda cerrada, o pegado a
  // otra reserva ignorando el `bookingBufferMin` configurado, porque la
  // única restricción vivía en la UI (los botones del BookingForm).
  const validSlots = await getAvailableSlots(product.id, ymdLocal(startsAt));
  const slotIso = startsAt.toISOString();
  if (!validSlots.some((s) => s.startsAt === slotIso)) {
    return {
      fieldErrors: {
        startsAt: "Ese horario ya no está disponible. Elige uno de la lista.",
      },
    };
  }

  const customerPhone = normalizePhoneBO(data.customerPhone);
  const endsAt = new Date(
    startsAt.getTime() + product.bookingDurationMin * 60_000,
  );

  const trackingToken = generateTrackingToken();
  let created: { id: string; trackingToken: string } | null = null;
  try {
    created = await db.$transaction(async (tx) => {
      // Lock advisory por producto: serializa creaciones concurrentes del
      // mismo servicio. Los findFirst de conflicto de abajo por sí solos
      // NO previenen la race — en READ COMMITTED dos transacciones pueden
      // ambas ver "sin conflicto" y ambas insertar el mismo slot. Con el
      // lock, la segunda espera al commit de la primera y su findFirst ya
      // ve la reserva nueva. Se libera solo al terminar la transacción.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${product.id}))`;
      // Buscamos cualquier booking activa que cruza con [startsAt, endsAt).
      // El guard `endsAt: { gt: now }` previene que una PENDING booking
      // del pasado (cliente nunca confirmado por el owner, ya pasó la hora)
      // bloquee slots futuros indefinidamente. Sin esto un servicio
      // popular que recibe 10 PENDING al día y nunca se gestionan
      // bloquea progresivamente los slots futuros sin que el owner sepa.
      const now = new Date();
      const conflict = await tx.booking.findFirst({
        where: {
          productId: product.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          // Solo bloquean slots futuros: una PENDING/CONFIRMED del pasado
          // ya no tiene sentido como conflicto.
          AND: { endsAt: { gt: now } },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new Error("__slot_taken__");
      }
      // Bloqueo del owner: si el slot cae en un rango bloqueado, no
      // se crea la reserva. Cierra la race entre "cliente cargó slots →
      // owner agregó bloqueo → cliente submite". Sin esto el slot
      // pasaba aunque el calendario ya lo mostraba como no disponible.
      const blocked = await tx.bookingBlock.findFirst({
        where: {
          storeId: product.storeId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      });
      if (blocked) {
        throw new Error("__slot_blocked__");
      }
      return tx.booking.create({
        data: {
          storeId: product.storeId,
          productId: product.id,
          customerName: data.customerName,
          customerPhone,
          customerEmail: data.customerEmail || null,
          notes: data.notes || null,
          startsAt,
          endsAt,
          status: BookingStatus.PENDING,
          trackingToken,
        },
        select: { id: true, trackingToken: true },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "__slot_taken__") {
      return {
        fieldErrors: {
          startsAt:
            "Alguien acaba de reservar ese horario. Prueba otro de la lista.",
        },
      };
    }
    if (err instanceof Error && err.message === "__slot_blocked__") {
      return {
        fieldErrors: {
          startsAt:
            "Ese horario ya no está disponible (el local lo bloqueó). Prueba otro.",
        },
      };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Colisión de trackingToken — astronómicamente rara, sino bug.
      return { error: "Error generando la reserva. Prueba de nuevo." };
    }
    throw err;
  }
  if (!created) return { error: "No pudimos crear la reserva." };

  await audit({
    action: "booking.created",
    storeId: product.storeId,
    target: created.id,
    metadata: { productId: product.id },
  });

  // Mensaje de WhatsApp pre-armado para el cliente al merchant.
  // `timeZone: America/La_Paz` evita que el server en UTC formatee la hora
  // 4 horas adelantada de lo que el cliente percibe en su pantalla.
  const dateFmt = startsAt.toLocaleString("es-BO", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  });
  const wa = buildWhatsAppUrl(
    product.store.whatsappPhone,
    `Hola, reservé ${product.name} para ${dateFmt}. Mi nombre es ${data.customerName}.`,
  );

  revalidatePath(`/dashboard/reservas`);
  revalidatePath(`/${product.store.slug}/p`, "layout");

  return { ok: { trackingToken: created.trackingToken, whatsappUrl: wa } };
}

// ============== Confirmar / Cancelar / Completar (owner + cashier) ==============
//
// Guard `requireStoreOwnerIds` permite STORE_OWNER, CASHIER y SUPER_ADMIN.
// Es intencional: en flujos operativos del local (peluquería, taller,
// consultorio), el cajero/recepcionista es quien marca "el cliente
// llegó" (confirmar), "el cliente avisó" (cancelar) y "atención
// terminada" (completar). Restringir a owner sería irrealista — el dueño
// está atendiendo, no frente a la pantalla.
//
// Decisiones de mayor impacto económico (verificar pago, asignar owner)
// sí usan `requireOwnerOnlyIds`.

const ownerActionSchema = z.object({
  bookingId: z.string().min(1),
  cancelReason: z.string().trim().max(200).optional(),
});

export async function confirmBookingAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const parsed = ownerActionSchema.safeParse({
    bookingId: formData.get("bookingId"),
  });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  const updated = await db.booking.updateMany({
    where: {
      id: parsed.data.bookingId,
      storeId,
      status: BookingStatus.PENDING,
    },
    data: {
      status: BookingStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return { error: "Reserva no encontrada o ya procesada." };
  }

  await audit({
    action: "booking.confirmed",
    actorId: userId,
    storeId,
    target: parsed.data.bookingId,
    metadata: {},
  });
  revalidatePath("/dashboard/reservas");
  return {};
}

export async function cancelBookingAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const parsed = ownerActionSchema.safeParse({
    bookingId: formData.get("bookingId"),
    cancelReason: (formData.get("cancelReason") as string) ?? "",
  });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  // Para cancelar una booking CONFIRMED (el cliente ya tiene compromiso)
  // exigimos razón con mínimo 3 chars, igual que `changeOrderStatusAction`.
  // PENDING puede cancelarse sin razón (todavía no hay compromiso real).
  const target = await db.booking.findFirst({
    where: { id: parsed.data.bookingId, storeId },
    select: { status: true },
  });
  if (!target) return { error: "Reserva no encontrada." };
  if (
    target.status === BookingStatus.CONFIRMED &&
    (!parsed.data.cancelReason || parsed.data.cancelReason.trim().length < 3)
  ) {
    return { error: "Indica el motivo de la cancelación (mínimo 3 caracteres)." };
  }

  const updated = await db.booking.updateMany({
    where: {
      id: parsed.data.bookingId,
      storeId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: parsed.data.cancelReason || null,
    },
  });
  if (updated.count === 0) {
    return { error: "Reserva no encontrada o no se puede cancelar." };
  }

  await audit({
    action: "booking.cancelled",
    actorId: userId,
    storeId,
    target: parsed.data.bookingId,
    metadata: { reason: parsed.data.cancelReason },
  });
  revalidatePath("/dashboard/reservas");
  return {};
}

export async function markBookingCompletedAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const id = String(formData.get("bookingId") ?? "");
  if (!id) return { error: INVALID_INPUT_ERROR };

  // Solo se puede marcar COMPLETED después de que comenzó la reserva.
  // Antes era posible "completar" una reserva CONFIRMED programada para
  // mañana — UI bug que podía corromper métricas de cumplimiento.
  const updated = await db.booking.updateMany({
    where: {
      id,
      storeId,
      status: BookingStatus.CONFIRMED,
      startsAt: { lte: new Date() },
    },
    data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
  });
  if (updated.count === 0) {
    return {
      error: "Reserva no confirmada o aún no comenzó.",
    };
  }

  await audit({
    action: "booking.completed",
    actorId: userId,
    storeId,
    target: id,
    metadata: {},
  });
  revalidatePath("/dashboard/reservas");
  return {};
}

/**
 * Marca la reserva como `NO_SHOW`: el cliente no se presentó al horario
 * confirmado. Estado terminal (no se puede revertir vía UI) — habilita
 * métricas de fiabilidad de clientes a futuro. Transición solo desde
 * CONFIRMED, igual que `markBookingCompletedAction`: una PENDING que
 * "no vino" semánticamente no tiene sentido (no confirmaste, no puedes
 * marcar ausencia).
 */
export async function markBookingNoShowAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const id = String(formData.get("bookingId") ?? "");
  if (!id) return { error: INVALID_INPUT_ERROR };

  const updated = await db.booking.updateMany({
    where: { id, storeId, status: BookingStatus.CONFIRMED },
    data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
  });
  if (updated.count === 0) return { error: "Reserva no confirmada." };

  await audit({
    action: "booking.no_show",
    actorId: userId,
    storeId,
    target: id,
    metadata: {},
  });
  revalidatePath("/dashboard/reservas");
  return {};
}
