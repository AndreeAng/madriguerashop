import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { validateCouponForOrder } from "@/lib/orders/coupon";

/**
 * `validateCouponForOrder` es el check fail-fast que comparten el preview del
 * checkout y la creación del pedido. Si divergen, el cliente paga por QR un
 * monto distinto al que el servidor cobra al confirmar. `coupon-toctou.test.ts`
 * cubre el row-lock de concurrencia; esto cubre las REGLAS de validación
 * (fechas, isActive, límites, mínimo, case-insensitive), que estaban a 0%.
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG = `test-cupval-${STAMP}`;
const NOW = new Date("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

let storeId: string;
let seq = 0;

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst();
  if (!template || !plan) throw new Error("Test DB sin template/plan (correr seed).");
  const store = await prisma.store.create({
    data: {
      slug: SLUG,
      name: "Test Cupón Validate",
      vertical: "RETAIL",
      templateId: template.id,
      planId: plan.id,
      whatsappPhone: "+59170000000",
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.couponUsage.deleteMany({ where: { coupon: { storeId } } });
  await prisma.order.deleteMany({ where: { storeId } });
  await prisma.coupon.deleteMany({ where: { storeId } });
  await prisma.store.deleteMany({ where: { id: storeId } });
  await prisma.$disconnect();
});

/** Crea un cupón con código único bajo la tienda de test. */
async function makeCoupon(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return prisma.coupon.create({
    data: {
      storeId,
      code: `CUP${STAMP}X${seq}`,
      type: "PERCENTAGE",
      value: 10,
      validFrom: new Date(NOW.getTime() - DAY),
      validTo: new Date(NOW.getTime() + DAY),
      isActive: true,
      ...overrides,
    },
  });
}

describe("validateCouponForOrder — cupón válido", () => {
  it("devuelve ok + pricing (type/value/maxDiscountAmount)", async () => {
    const coupon = await makeCoupon({ value: 15, maxDiscountAmount: 50 });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.id).toBe(coupon.id);
      expect(res.code).toBe(coupon.code);
      expect(res.pricing).toEqual({
        type: "PERCENTAGE",
        value: 15,
        maxDiscountAmount: 50,
      });
    }
  });

  it("normaliza el código a mayúsculas (input en minúsculas matchea)", async () => {
    const coupon = await makeCoupon();
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code.toLowerCase(),
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res.ok).toBe(true);
  });
});

describe("validateCouponForOrder — rechazos", () => {
  it("código inexistente → 'Cupón inválido'", async () => {
    const res = await validateCouponForOrder({
      storeId,
      code: "NOEXISTE",
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, message: "Cupón inválido" });
  });

  it("cupón inactivo → 'Cupón inválido'", async () => {
    const coupon = await makeCoupon({ isActive: false });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, message: "Cupón inválido" });
  });

  it("antes de validFrom → 'Cupón fuera de fecha'", async () => {
    const coupon = await makeCoupon({
      validFrom: new Date(NOW.getTime() + DAY), // arranca mañana
      validTo: new Date(NOW.getTime() + 2 * DAY),
    });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, message: "Cupón fuera de fecha" });
  });

  it("después de validTo → 'Cupón fuera de fecha'", async () => {
    const coupon = await makeCoupon({
      validFrom: new Date(NOW.getTime() - 2 * DAY),
      validTo: new Date(NOW.getTime() - DAY), // venció ayer
    });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, message: "Cupón fuera de fecha" });
  });

  it("usageLimit alcanzado → 'Cupón agotado'", async () => {
    const coupon = await makeCoupon({ usageLimit: 5, usedCount: 5 });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, message: "Cupón agotado" });
  });

  it("subtotal por debajo de minOrderAmount → mensaje con el mínimo", async () => {
    const coupon = await makeCoupon({ minOrderAmount: 100 });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 80, // < 100
      customerPhone: null,
      now: NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/[Mm]ínimo/);
  });
});

describe("validateCouponForOrder — usageLimitPerUser", () => {
  it("cliente que ya usó el cupón (límite 1) → 'Ya usaste este cupón.'", async () => {
    const phone = `+591${STAMP % 90000000}`;
    const coupon = await makeCoupon({ usageLimitPerUser: 1 });
    // Registrar un uso previo de este cliente (requiere un Order por la FK).
    const order = await prisma.order.create({
      data: {
        orderNumber: Math.floor(Math.random() * 1_000_000),
        trackingToken: `tok-${STAMP}-${seq}`,
        storeId,
        customerName: "Cliente",
        customerPhone: phone,
        deliveryAddress: "Test 123",
        subtotal: 100,
        total: 100,
        paymentMethod: "CASH_ON_DELIVERY",
        couponId: coupon.id,
      },
    });
    await prisma.couponUsage.create({
      data: { couponId: coupon.id, orderId: order.id, customerPhone: phone },
    });

    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: phone,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, message: "Ya usaste este cupón." });
  });

  it("con customerPhone null se OMITE el check por-usuario (queda ok)", async () => {
    // El preview sin teléfono no debe rechazar por usageLimitPerUser; la
    // transacción de creación lo re-verifica igual con el teléfono real.
    const coupon = await makeCoupon({ usageLimitPerUser: 1 });
    const res = await validateCouponForOrder({
      storeId,
      code: coupon.code,
      subtotal: 200,
      customerPhone: null,
      now: NOW,
    });
    expect(res.ok).toBe(true);
  });
});
