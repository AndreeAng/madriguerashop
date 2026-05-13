import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}
const pad2 = (n: number) => String(n).padStart(2, "0");

async function getSlots(productId: string, dateYmd: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      isBookable: true,
      bookingDurationMin: true,
      bookingBufferMin: true,
      store: {
        select: {
          storeHours: {
            select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
          },
        },
      },
    },
  });
  if (!product || !product.isBookable) {
    console.log("  Producto no reservable o no encontrado");
    return [];
  }
  const [year, month, day] = dateYmd.split("-").map((n) => parseInt(n, 10));
  const dayStart = new Date(year!, month! - 1, day!, 0, 0, 0);
  const dayEnd = new Date(year!, month! - 1, day!, 23, 59, 59);
  const dow = dayStart.getDay();
  console.log(`  Buscando dow=${dow} ${dayStart.toString()}`);
  const hours = product.store.storeHours.find((h) => h.dayOfWeek === dow);
  if (!hours) {
    console.log("  NO STORE HOURS para ese día");
    return [];
  }
  if (hours.isClosed) {
    console.log("  CERRADO ese día");
    return [];
  }
  console.log(`  Horario: ${hours.openTime} - ${hours.closeTime}`);
  const openMin = parseHHMM(hours.openTime);
  const closeMin = parseHHMM(hours.closeTime);
  const stepMin = product.bookingDurationMin + product.bookingBufferMin;
  const bookings = await db.booking.findMany({
    where: {
      productId,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });
  console.log(`  Bookings existentes: ${bookings.length}`);
  const now = new Date();
  const slots: { label: string; startsAt: string }[] = [];
  for (let m = openMin; m + product.bookingDurationMin <= closeMin; m += stepMin) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const slotStart = new Date(year!, month! - 1, day!, hh, mm, 0);
    if (slotStart <= now) continue;
    slots.push({ label: `${pad2(hh)}:${pad2(mm)}`, startsAt: slotStart.toISOString() });
  }
  return slots;
}

async function main() {
  const p = await db.product.findFirst({
    where: { slug: "corte-mujer", store: { slug: "estudio-clara" } },
    select: { id: true, name: true },
  });
  if (!p) {
    console.log("Producto no encontrado");
    return;
  }
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  for (const d of [today, tomorrow]) {
    console.log(`\n${p.name} en ${ymd(d)}:`);
    const slots = await getSlots(p.id, ymd(d));
    console.log(`  Total: ${slots.length} slots`);
    for (const s of slots.slice(0, 5)) console.log(`    ${s.label}`);
  }
  await db.$disconnect();
}
main();
