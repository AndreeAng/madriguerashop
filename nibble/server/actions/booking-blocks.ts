"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreOwnerIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import {
  parseBoliviaDate,
  parseBoliviaDateTime,
} from "@/lib/booking/timezone";
import { INVALID_INPUT_ERROR } from "@/lib/validation/actionState";

export type BlockFormState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<"startsAt" | "endsAt" | "reason", string>>;
  /** Warning soft: el bloqueo se creó, pero hay reservas existentes en el
   *  rango que el owner debe gestionar manualmente (cancelar y avisar al
   *  cliente). No bloqueamos la creación porque a veces el owner usa el
   *  bloqueo precisamente para "cerrar" un día con reservas conocidas. */
  conflictingBookings?: number;
};

const createSchema = z.object({
  startsAt: z.string().min(1, "Fecha y hora de inicio requeridas"),
  endsAt: z.string().min(1, "Fecha y hora de fin requeridas"),
  reason: z.string().trim().max(200).optional().default(""),
  /** Si está marcado, los inputs son `<input type="date">` (sin hora) y
   *  el rango se expande a "todo el día Bolivia". Si no, son
   *  `<input type="datetime-local">` con hora exacta en Bolivia. */
  allDay: z.boolean().optional().default(false),
});

export async function createBookingBlockAction(
  _prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  const { storeId, userId } = await requireStoreOwnerIds();

  const parsed = createSchema.safeParse({
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    reason: formData.get("reason") ?? "",
    allDay: formData.get("allDay") === "on",
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<BlockFormState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  // Parseo TZ-aware: las strings de los inputs representan hora-pared en
  // Bolivia, no en la TZ del proceso. Sin esto, en Vercel (UTC) los
  // bloqueos quedaban desfasados 4 h.
  //
  // Convención del rango: half-open [start, end). Día entero del 12-may
  // es [00:00 12-may BOT, 00:00 13-may BOT). Esto coincide con la query
  // que usa el slot generator (`lt: dayEnd`) y elimina ambigüedades de
  // borde que tenía la antigua convención "23:59:59.999".
  let startsAt: Date | null;
  let endsAt: Date | null;
  if (data.allDay) {
    startsAt = parseBoliviaDate(data.startsAt);
    const endDay = parseBoliviaDate(data.endsAt);
    if (endDay) {
      endsAt = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
    } else {
      endsAt = null;
    }
  } else {
    startsAt = parseBoliviaDateTime(data.startsAt);
    endsAt = parseBoliviaDateTime(data.endsAt);
  }
  if (!startsAt) {
    return { fieldErrors: { startsAt: "Fecha inválida" } };
  }
  if (!endsAt) {
    return { fieldErrors: { endsAt: "Fecha inválida" } };
  }
  if (endsAt <= startsAt) {
    return {
      fieldErrors: { endsAt: "La fecha fin debe ser posterior al inicio." },
    };
  }

  // Buscar reservas activas que caigan dentro del rango — el bloqueo
  // impide nuevas reservas pero las existentes quedan "huérfanas" si no
  // las gestiona el owner. Contamos y devolvemos el número para que la
  // UI le pida confirmar/cancelar esas reservas manualmente.
  const conflictingBookings = await db.booking.count({
    where: {
      storeId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });

  const block = await db.bookingBlock.create({
    data: {
      storeId,
      startsAt,
      endsAt,
      reason: data.reason || null,
    },
    select: { id: true },
  });

  // `target` = id del bloqueo creado (no storeId) para consistencia con
  // el resto del módulo: el target identifica el recurso operado, y la
  // metadata acompaña con storeId. Antes esto era target=storeId que
  // mezclaba "qué se operó" con "dónde", rompiendo filtros por target.
  await audit({
    action: "booking_block.created",
    actorId: userId,
    target: block.id,
    metadata: {
      storeId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: data.reason || null,
      conflictingBookings,
    },
  });

  revalidatePath("/dashboard/reservas");
  return {
    ok: true,
    ...(conflictingBookings > 0 ? { conflictingBookings } : {}),
  };
}

export async function deleteBookingBlockAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireStoreOwnerIds();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: INVALID_INPUT_ERROR };

  const deleted = await db.bookingBlock.deleteMany({
    where: { id, storeId },
  });
  if (deleted.count === 0) return { error: "Bloqueo no encontrado" };

  await audit({
    action: "booking_block.deleted",
    actorId: userId,
    target: id,
    metadata: { storeId },
  });

  revalidatePath("/dashboard/reservas");
  return {};
}
