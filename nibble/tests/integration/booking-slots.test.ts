import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getAvailableSlots } from "@/lib/booking/slots";
import { dateInBolivia } from "@/lib/booking/timezone";

/**
 * Generación de slots reservables — el corazón del vertical SERVICES.
 *
 * Reglas que verificamos contra DB real:
 *   - respeta el horario de apertura del día (dow) en hora Bolivia
 *   - el paso de la grilla = bookingDurationMin + bookingBufferMin
 *   - excluye slots que se cruzan con Bookings activas (PENDING/CONFIRMED)
 *   - excluye slots que se cruzan con BookingBlocks del owner
 *   - producto no reservable / día cerrado / sin horario → sin slots
 *
 * Usamos una fecha MUY futura (2030) porque `getAvailableSlots` filtra slots
 * pasados con `new Date()` real (no inyectable): así todos los slots quedan
 * en el futuro sin importar cuándo corra el test.
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG = `test-slots-${STAMP}`;

// Fechas futuras en 3 días de semana distintos (10, 11, 12 de junio 2030).
// El dow se calcula con el MISMO `new Date(y, m-1, d).getDay()` que usa el
// módulo, así el horario que creamos matchea exactamente.
const OPEN_YMD = "2030-06-10";
const CLOSED_YMD = "2030-06-11";
const NOHOURS_YMD = "2030-06-12";
const dowOpen = new Date(2030, 5, 10).getDay();
const dowClosed = new Date(2030, 5, 11).getDay();

let storeId: string;
let seq = 0;

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst();
  if (!template || !plan) throw new Error("Test DB sin template/plan (correr seed).");
  const store = await prisma.store.create({
    data: {
      slug: SLUG,
      name: "Test Slots",
      vertical: "SERVICES",
      templateId: template.id,
      planId: plan.id,
      whatsappPhone: "+59170000000",
      storeHours: {
        create: [
          { dayOfWeek: dowOpen, openTime: "10:00", closeTime: "12:00", isClosed: false },
          { dayOfWeek: dowClosed, openTime: "10:00", closeTime: "12:00", isClosed: true },
        ],
      },
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { storeId } });
  await prisma.bookingBlock.deleteMany({ where: { storeId } });
  await prisma.storeHours.deleteMany({ where: { storeId } });
  await prisma.product.deleteMany({ where: { storeId } });
  await prisma.store.deleteMany({ where: { id: storeId } });
  await prisma.$disconnect();
});

/** Producto reservable fresco (aísla bookings/bloqueos entre tests). */
async function makeBookableProduct(opts: { dur?: number; buffer?: number; bookable?: boolean } = {}) {
  seq += 1;
  return prisma.product.create({
    data: {
      storeId,
      name: `Servicio ${seq}`,
      slug: `svc-${STAMP}-${seq}`,
      basePrice: 100,
      isBookable: opts.bookable ?? true,
      bookingDurationMin: opts.dur ?? 30,
      bookingBufferMin: opts.buffer ?? 0,
    },
  });
}

async function makeBooking(productId: string, hh: number, mm: number, dur: number, status: "PENDING" | "CONFIRMED" | "CANCELLED") {
  seq += 1;
  const startsAt = dateInBolivia(2030, 5, 10, hh, mm);
  return prisma.booking.create({
    data: {
      storeId,
      productId,
      customerName: "Cliente",
      customerPhone: "+59170000000",
      startsAt,
      endsAt: new Date(startsAt.getTime() + dur * 60_000),
      status,
      trackingToken: `bk-${STAMP}-${seq}`,
    },
  });
}

const labels = (slots: { label: string }[]) => slots.map((s) => s.label);

describe("getAvailableSlots — grilla básica", () => {
  it("genera slots dentro del horario, paso = duración (30min)", async () => {
    const p = await makeBookableProduct({ dur: 30, buffer: 0 });
    const slots = await getAvailableSlots(p.id, OPEN_YMD);
    expect(labels(slots)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    // El startsAt del primer slot es 10:00 hora Bolivia.
    expect(slots[0]!.startsAt).toBe(dateInBolivia(2030, 5, 10, 10, 0).toISOString());
  });

  it("el buffer aumenta el paso: dur 30 + buffer 30 → paso 60min", async () => {
    const p = await makeBookableProduct({ dur: 30, buffer: 30 });
    const slots = await getAvailableSlots(p.id, OPEN_YMD);
    expect(labels(slots)).toEqual(["10:00", "11:00"]);
  });
});

describe("getAvailableSlots — sin slots", () => {
  it("producto no reservable → []", async () => {
    const p = await makeBookableProduct({ bookable: false });
    expect(await getAvailableSlots(p.id, OPEN_YMD)).toEqual([]);
  });

  it("día marcado como cerrado → []", async () => {
    const p = await makeBookableProduct();
    expect(await getAvailableSlots(p.id, CLOSED_YMD)).toEqual([]);
  });

  it("día sin horario configurado → []", async () => {
    const p = await makeBookableProduct();
    expect(await getAvailableSlots(p.id, NOHOURS_YMD)).toEqual([]);
  });

  it("producto inexistente → []", async () => {
    expect(await getAvailableSlots("noexiste", OPEN_YMD)).toEqual([]);
  });
});

describe("getAvailableSlots — exclusiones por cruce", () => {
  it("una Booking PENDING ocupa su slot (y solo ese)", async () => {
    const p = await makeBookableProduct({ dur: 30, buffer: 0 });
    await makeBooking(p.id, 10, 30, 30, "PENDING"); // 10:30–11:00
    const slots = await getAvailableSlots(p.id, OPEN_YMD);
    expect(labels(slots)).toEqual(["10:00", "11:00", "11:30"]);
  });

  it("una Booking CANCELLED NO bloquea el slot", async () => {
    const p = await makeBookableProduct({ dur: 30, buffer: 0 });
    await makeBooking(p.id, 10, 0, 30, "CANCELLED"); // 10:00, cancelada
    const slots = await getAvailableSlots(p.id, OPEN_YMD);
    expect(labels(slots)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
  });

  it("un BookingBlock excluye todos los slots que se cruzan", async () => {
    const p = await makeBookableProduct({ dur: 30, buffer: 0 });
    await prisma.bookingBlock.create({
      data: {
        storeId,
        startsAt: dateInBolivia(2030, 5, 10, 11, 0), // bloquea 11:00–12:00
        endsAt: dateInBolivia(2030, 5, 10, 12, 0),
        reason: "Capacitación",
      },
    });
    const slots = await getAvailableSlots(p.id, OPEN_YMD);
    expect(labels(slots)).toEqual(["10:00", "10:30"]);
  });
});
