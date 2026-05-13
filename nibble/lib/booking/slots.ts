import "server-only";
import { db } from "@/lib/db";
import { dateInBolivia } from "@/lib/booking/timezone";

/**
 * Cálculo de slots disponibles para reservar un servicio.
 *
 * Dado un producto reservable + una fecha, genera la lista de horarios
 * donde un cliente puede agendarse. Para cada slot validamos:
 *   1. Que esté dentro del horario de apertura de la tienda ese día.
 *   2. Que no se cruce con otra Booking activa (PENDING o CONFIRMED).
 *   3. Que el slot esté en el futuro (ningún cliente puede reservar
 *      una hora que ya pasó).
 *
 * Devuelve solo horas (ISO timestamps) — la UI las muestra como "10:00",
 * "10:30", etc. Cada slot dura `bookingDurationMin` minutos + el buffer
 * configurado.
 *
 * El timezone se maneja vía `dateInBolivia()` (ver `lib/booking/timezone.ts`)
 * — antes de eso, el slot generator usaba TZ del proceso y los slots
 * aparecían 4 h desfasados en Vercel.
 */

export type Slot = {
  /** ISO timestamp del inicio del slot. */
  startsAt: string;
  /** "HH:MM" para mostrar en UI sin tocar locale. */
  label: string;
};

/** Convierte "HH:MM" en minutos desde medianoche. */
function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export async function getAvailableSlots(
  productId: string,
  /** Fecha local del cliente (YYYY-MM-DD). */
  dateYmd: string,
): Promise<Slot[]> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      storeId: true,
      isBookable: true,
      bookingDurationMin: true,
      bookingBufferMin: true,
      store: {
        select: {
          storeHours: {
            select: {
              dayOfWeek: true,
              openTime: true,
              closeTime: true,
              isClosed: true,
            },
          },
        },
      },
    },
  });
  if (!product || !product.isBookable) return [];

  // Construir el rango del día en HORA BOLIVIA, independiente de la TZ
  // del proceso. Ver explicación arriba — antes esto era fuente de bug
  // crítico en Vercel (UTC) donde los slots aparecían 4 h desfasados.
  const [year, month, day] = dateYmd.split("-").map((n) => parseInt(n, 10));
  if (!year || !month || !day) return [];
  const dayStart = dateInBolivia(year, month - 1, day, 0, 0, 0, 0);
  // Para el dow usamos la fecha "naive" (sin offset): la decisión
  // "es martes" depende solo de la fecha calendario, no de qué hora es.
  // Bolivia no cruza fecha por TZ entre 00:00 y 23:59 BOT.
  const dow = new Date(year, month - 1, day).getDay(); // 0=Dom ... 6=Sáb
  // dayEnd como límite half-open: comienzo del día siguiente. Más limpio
  // que `23:59:59.999` para queries de rango.
  const dayEnd = dateInBolivia(year, month - 1, day + 1, 0, 0, 0, 0);

  const hours = product.store.storeHours.find((h) => h.dayOfWeek === dow);
  if (!hours || hours.isClosed) return [];

  const openMin = parseHHMM(hours.openTime);
  const closeMin = parseHHMM(hours.closeTime);
  const stepMin = product.bookingDurationMin + product.bookingBufferMin;
  if (stepMin <= 0) return [];

  // Bookings existentes ese día que ocupan slots. Excluimos cancelados.
  const bookings = await db.booking.findMany({
    where: {
      productId,
      startsAt: { gte: dayStart, lt: dayEnd },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { startsAt: true, endsAt: true },
  });

  // Bloqueos del owner: vacaciones (día entero), almuerzo, capacitación,
  // etc. Cualquier slot que se cruce con un bloque queda fuera, sin
  // importar que el día esté "abierto" en storeHours.
  const blocks = await db.bookingBlock.findMany({
    where: {
      storeId: product.storeId,
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    select: { startsAt: true, endsAt: true },
  });

  const now = new Date();
  const slots: Slot[] = [];
  for (let m = openMin; m + product.bookingDurationMin <= closeMin; m += stepMin) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const slotStart = dateInBolivia(year, month - 1, day, hh, mm, 0, 0);
    const slotEnd = new Date(
      slotStart.getTime() + product.bookingDurationMin * 60_000,
    );

    // Slot en el pasado → omitir.
    if (slotStart <= now) continue;

    // Cruce con booking existente: hay cruce si NO (slotEnd <= bookingStart
    // OR slotStart >= bookingEnd). Lo expresamos invertido para corte
    // temprano del filter.
    const overlaps = bookings.some(
      (b) => slotStart < b.endsAt && slotEnd > b.startsAt,
    );
    if (overlaps) continue;

    // Cruce con bloqueo del owner — misma lógica que para bookings.
    const blocked = blocks.some(
      (b) => slotStart < b.endsAt && slotEnd > b.startsAt,
    );
    if (blocked) continue;

    slots.push({
      startsAt: slotStart.toISOString(),
      label: `${pad2(hh)}:${pad2(mm)}`,
    });
  }

  return slots;
}
