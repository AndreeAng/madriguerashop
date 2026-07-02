import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyOrderImpact, revertOrderImpact } from "@/lib/orders/impact";

/**
 * Integración del impacto de inventario de un pedido contra Postgres real.
 *
 * `applyOrderImpact` (al crear/verificar) y `revertOrderImpact` (al cancelar/
 * rechazar) son el corazón de la corrección de inventario. Deben ser
 * INVERSAS: aplicar y luego revertir debe dejar stock y contadores del
 * cliente exactamente como estaban. Un bug acá = stock fantasma o sobreventa.
 *
 * También verificamos el guard anti-sobreventa (decremento condicional).
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG = `test-stock-${STAMP}`;

let templateId: string;
let planId: string;
let storeId: string;

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst();
  if (!template || !plan) throw new Error("Test DB sin template/plan (correr seed).");
  templateId = template.id;
  planId = plan.id;

  const store = await prisma.store.create({
    data: {
      slug: SLUG,
      name: "Test Stock Store",
      vertical: "RETAIL",
      templateId,
      planId,
      whatsappPhone: "+59170000000",
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { storeId } } });
  await prisma.order.deleteMany({ where: { storeId } });
  await prisma.product.deleteMany({ where: { storeId } });
  await prisma.customer.deleteMany({ where: { storeId } });
  await prisma.store.deleteMany({ where: { id: storeId } });
  await prisma.$disconnect();
});

/** Crea producto + customer + order(1 item) frescos. Devuelve sus ids. */
async function makeOrderFixture(stock: number, quantity: number) {
  const product = await prisma.product.create({
    data: {
      storeId,
      name: `Prod ${Math.random()}`,
      slug: `prod-${STAMP}-${Math.random().toString(36).slice(2, 8)}`,
      basePrice: 30,
      manageStock: true,
      stock,
    },
  });
  const customer = await prisma.customer.create({
    // phone único por fixture — Customer tiene @@unique([storeId, phone]).
    data: {
      storeId,
      fullName: "Cliente Test",
      phone: `+591${Math.floor(Math.random() * 90000000 + 10000000)}`,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: Math.floor(Math.random() * 1_000_000),
      trackingToken: `tok-${STAMP}-${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      customerId: customer.id,
      customerName: "Cliente Test",
      customerPhone: "+59170000000",
      deliveryAddress: "Test 123",
      subtotal: 30 * quantity,
      total: 30 * quantity,
      paymentMethod: "CASH_ON_DELIVERY",
      stockApplied: false,
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: 30,
          subtotal: 30 * quantity,
        },
      },
    },
  });
  return { productId: product.id, customerId: customer.id, orderId: order.id };
}

describe("applyOrderImpact / revertOrderImpact — round trip", () => {
  it("aplicar decrementa stock e incrementa contadores del cliente", async () => {
    const { productId, customerId, orderId } = await makeOrderFixture(10, 3);

    await prisma.$transaction((tx) => applyOrderImpact(tx, orderId));

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(product!.stock).toBe(7); // 10 - 3
    expect(customer!.ordersCount).toBe(1);
    expect(Number(customer!.totalSpent)).toBe(90); // 30 * 3
    expect(order!.stockApplied).toBe(true);
  });

  it("revertir restituye stock y contadores EXACTAMENTE al estado inicial", async () => {
    const { productId, customerId, orderId } = await makeOrderFixture(10, 4);

    await prisma.$transaction((tx) => applyOrderImpact(tx, orderId));
    await prisma.$transaction((tx) => revertOrderImpact(tx, orderId));

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(product!.stock).toBe(10); // restaurado
    expect(customer!.ordersCount).toBe(0);
    expect(Number(customer!.totalSpent)).toBe(0);
    expect(order!.stockApplied).toBe(false);
  });

  it("revertir es idempotente: dos reverts no dejan stock ni contadores negativos", async () => {
    const { productId, customerId, orderId } = await makeOrderFixture(10, 2);

    await prisma.$transaction((tx) => applyOrderImpact(tx, orderId));
    await prisma.$transaction((tx) => revertOrderImpact(tx, orderId));
    await prisma.$transaction((tx) => revertOrderImpact(tx, orderId)); // segundo revert

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    expect(product!.stock).toBe(10);
    expect(customer!.ordersCount).toBe(0);
    expect(Number(customer!.totalSpent)).toBe(0);
  });

  it("aplicar dos veces NO doble-decrementa (guard stockApplied)", async () => {
    const { productId, orderId } = await makeOrderFixture(10, 3);

    await prisma.$transaction((tx) => applyOrderImpact(tx, orderId));
    await prisma.$transaction((tx) => applyOrderImpact(tx, orderId)); // no-op

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product!.stock).toBe(7); // sigue en 7, no 4
  });

  it("aplicar con cantidad > stock lanza (guard anti-sobreventa)", async () => {
    const { orderId } = await makeOrderFixture(2, 5); // pide 5, hay 2

    await expect(
      prisma.$transaction((tx) => applyOrderImpact(tx, orderId)),
    ).rejects.toThrow(/insuficiente/i);
  });
});
