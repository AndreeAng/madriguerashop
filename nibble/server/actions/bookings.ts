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
import { buildWhatsAppUrl } from "@/lib/utils";

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
  startsAt: z.string().min(1, "Elegí un horario"),
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
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
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

  const customerPhone = normalizePhoneBO(data.customerPhone);
  const endsAt = new Date(
    startsAt.getTime() + product.bookingDurationMin * 60_000,
  );

  // Re-validar disponibilidad inside transaction: el slot pudo haberse
  // tomado entre que el cliente lo vio y submiteó. Sin el lock, dos
  // clientes podrían reservar el mismo horario.
  const trackingToken = generateTrackingToken();
  let created: { id: string; trackingToken: string } | null = null;
  try {
    created = await db.$transaction(async (tx) => {
      // Buscamos cualquier booking activa que cruza con [startsAt, endsAt).
      const conflict = await tx.booking.findFirst({
        where: {
          productId: product.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
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
            "Alguien acaba de reservar ese horario. Probá otro de la lista.",
        },
      };
    }
    if (err instanceof Error && err.message === "__slot_blocked__") {
      return {
        fieldErrors: {
          startsAt:
            "Ese horario ya no está disponible (el local lo bloqueó). Probá otro.",
        },
      };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Colisión de trackingToken — astronómicamente rara, sino bug.
      return { error: "Error generando la reserva. Probá de nuevo." };
    }
    throw err;
  }
  if (!created) return { error: "No pudimos crear la reserva." };

  await audit({
    action: "order.created",
    target: created.id,
    metadata: { bookingCreated: true, productId: product.id, storeId: product.storeId },
  });

  // Mensaje de WhatsApp pre-armado para el cliente al merchant.
  const dateFmt = startsAt.toLocaleString("es-BO", {
    dateStyle: "full",
    timeStyle: "short",
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
  if (!parsed.success) return { error: "Datos inválidos" };

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
    action: "order.status_changed",
    actorId: userId,
    target: parsed.data.bookingId,
    metadata: { bookingConfirmed: true, storeId },
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
  if (!parsed.success) return { error: "Datos inválidos" };

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
    action: "order.status_changed",
    actorId: userId,
    target: parsed.data.bookingId,
    metadata: { bookingCancelled: true, storeId, reason: parsed.data.cancelReason },
  });
  revalidatePath("/dashboard/reservas");
  return {};
}

export async function markBookingCompletedAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const id = String(formData.get("bookingId") ?? "");
  if (!id) return { error: "Datos inválidos" };

  const updated = await db.booking.updateMany({
    where: { id, storeId, status: BookingStatus.CONFIRMED },
    data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
  });
  if (updated.count === 0) return { error: "Reserva no confirmada." };

  await audit({
    action: "order.status_changed",
    actorId: userId,
    target: id,
    metadata: { bookingCompleted: true, storeId },
  });
  revalidatePath("/dashboard/reservas");
  return {};
}

/**
 * Marca la reserva como `NO_SHOW`: el cliente no se presentó al horario
 * confirmado. Estado terminal (no se puede revertir vía UI) — habilita
 * métricas de fiabilidad de clientes a futuro. Transición solo desde
 * CONFIRMED, igual que `markBookingCompletedAction`: una PENDING que
 * "no vino" semánticamente no tiene sentido (no confirmaste, no podés
 * marcar ausencia).
 */
export async function markBookingNoShowAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const id = String(formData.get("bookingId") ?? "");
  if (!id) return { error: "Datos inválidos" };

  const updated = await db.booking.updateMany({
    where: { id, storeId, status: BookingStatus.CONFIRMED },
    data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
  });
  if (updated.count === 0) return { error: "Reserva no confirmada." };

  await audit({
    action: "order.status_changed",
    actorId: userId,
    target: id,
    metadata: { bookingNoShow: true, storeId },
  });
  revalidatePath("/dashboard/reservas");
  return {};
}
