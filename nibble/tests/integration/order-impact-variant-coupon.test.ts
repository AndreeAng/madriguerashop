import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyOrderImpact, revertOrderImpact } from "@/lib/orders/impact";

/**
 * Huecos de `orders/impact` que `order-stock.test.ts` no cubre:
 *
 *  1. STOCK DE VARIANTE — cuando el item tiene `variantId`, el impacto va sobre
 *     el stock de la VARIANTE, no del producto. `order-stock` sólo prueba stock
 *     a nivel producto.
 *
 *  2. REVERT DE CUPÓN — al cancelar un pedido, su `CouponUsage` se borra y el
 *     `usedCount` del cupón se decrementa. Este revert corre SIEMPRE, no sólo
 *     si el stock fue aplicado.
 *
 *  3. FLUJO QR (pre-verificación) — un pedido con `stockApplied=false` (QR sin
 *     verificar) que se cancela NO debe restituir stock/contadores (nunca se
 *     decrementaron) PERO SÍ debe revertir el cupón (el uso se registró al crear).
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG = `test-impact-x-${STAMP}`;

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
      name: "Test Impact Variant/Coupon",
      vertical: "RETAIL",
      templateId,
      planId,
      whatsappPhone: "+59170000000",
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  // Orden de borrado respetando FKs: usages → items → orders → coupons →
  // variants → products → customers → store.
  await prisma.couponUsage.deleteMany({ where: { coupon: { storeId } } });
  await prisma.orderItem.deleteMany({ where: { order: { storeId } } });
  await prisma.order.deleteMany({ where: { storeId } });
  await prisma.coupon.deleteMany({ where: { storeId } });
  await prisma.productVariant.deleteMany({ where: { product: { storeId } } });
  await prisma.product.deleteMany({ where: { storeId } });
  await prisma.customer.deleteMany({ where: { storeId } });
  await prisma.store.deleteMany({ where: { id: storeId } });
  await prisma.$disconnect();
});

const rnd = () => Math.random().toString(36).slice(2, 8);

async function makeCustomer() {
  return prisma.customer.create({
    data: {
      storeId,
      fullName: "Cliente Test",
      phone: `+591${Math.floor(Math.random() * 90000000 + 10000000)}`,
    },
  });
}

describe("applyOrderImpact / revertOrderImpact — stock de VARIANTE", () => {
  it("decrementa y restituye el stock de la variante, no el del producto", async () => {
    // Producto sin manejo de stock; la variante SÍ lo maneja.
    const product = await prisma.product.create({
      data: {
        storeId,
        name: `Prod ${rnd()}`,
        slug: `prod-${STAMP}-${rnd()}`,
        basePrice: 50,
        manageStock: false,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "Talla M",
        manageStock: true,
        stock: 10,
        attributes: {},
      },
    });
    const customer = await makeCustomer();
    const order = await prisma.order.create({
      data: {
        orderNumber: Math.floor(Math.random() * 1_000_000),
        trackingToken: `tok-${STAMP}-${rnd()}`,
        storeId,
        customerId: customer.id,
        customerName: "Cliente Test",
        customerPhone: "+59170000000",
        deliveryAddress: "Test 123",
        subtotal: 150,
        total: 150,
        paymentMethod: "CASH_ON_DELIVERY",
        stockApplied: false,
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            variantName: variant.name,
            quantity: 3,
            unitPrice: 50,
            subtotal: 150,
          },
        },
      },
    });

    await prisma.$transaction((tx) => applyOrderImpact(tx, order.id));
    let v = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    const p = await prisma.product.findUnique({ where: { id: product.id } });
    expect(v!.stock).toBe(7); // 10 - 3
    expect(p!.stock).toBe(0); // producto no maneja stock: intacto

    await prisma.$transaction((tx) => revertOrderImpact(tx, order.id));
    v = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(v!.stock).toBe(10); // restituido
  });
});

/** Crea cupón + pedido asociado con un CouponUsage ya registrado (como lo
 *  deja la creación del pedido). Devuelve ids + el producto para chequear stock. */
async function makeCouponOrder(opts: { stockApplied: boolean }) {
  const product = await prisma.product.create({
    data: {
      storeId,
      name: `Prod ${rnd()}`,
      slug: `prod-${STAMP}-${rnd()}`,
      basePrice: 30,
      manageStock: true,
      stock: 10,
    },
  });
  const customer = await makeCustomer();
  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code: `CUP${rnd().toUpperCase()}`,
      type: "PERCENTAGE",
      value: 10,
      usedCount: 1, // ya "consumido" por este pedido al crearse
      validFrom: new Date(Date.now() - 86_400_000),
      validTo: new Date(Date.now() + 86_400_000),
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: Math.floor(Math.random() * 1_000_000),
      trackingToken: `tok-${STAMP}-${rnd()}`,
      storeId,
      customerId: customer.id,
      customerName: "Cliente Test",
      customerPhone: "+59170000001",
      deliveryAddress: "Test 123",
      subtotal: 90,
      total: 81,
      paymentMethod: "QR_STATIC",
      couponId: coupon.id,
      stockApplied: opts.stockApplied,
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          quantity: 3,
          unitPrice: 30,
          subtotal: 90,
        },
      },
    },
  });
  // El uso del cupón se registra al CREAR el pedido (no en applyOrderImpact).
  await prisma.couponUsage.create({
    data: { couponId: coupon.id, orderId: order.id, customerPhone: "+59170000001" },
  });
  return { productId: product.id, customerId: customer.id, couponId: coupon.id, orderId: order.id };
}

describe("revertOrderImpact — revert de cupón", () => {
  it("en un pedido APLICADO: restituye stock Y borra el uso del cupón (usedCount 1→0)", async () => {
    const { productId, couponId, orderId } = await makeCouponOrder({ stockApplied: false });
    await prisma.$transaction((tx) => applyOrderImpact(tx, orderId)); // stock 10→7

    await prisma.$transaction((tx) => revertOrderImpact(tx, orderId));

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    const usages = await prisma.couponUsage.count({ where: { orderId } });
    expect(product!.stock).toBe(10); // restituido
    expect(coupon!.usedCount).toBe(0); // 1 - 1
    expect(usages).toBe(0); // CouponUsage borrado
  });

  it("flujo QR pre-verificación (stockApplied=false): NO toca stock/contadores pero SÍ revierte el cupón", async () => {
    const { productId, customerId, couponId, orderId } = await makeCouponOrder({
      stockApplied: false,
    });
    // OJO: NO llamamos applyOrderImpact — simula un QR cancelado antes de verificar.

    await prisma.$transaction((tx) => revertOrderImpact(tx, orderId));

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    const usages = await prisma.couponUsage.count({ where: { orderId } });
    // Stock y contadores intactos: nunca se aplicaron.
    expect(product!.stock).toBe(10);
    expect(customer!.ordersCount).toBe(0);
    expect(Number(customer!.totalSpent)).toBe(0);
    // Pero el cupón SÍ se revierte (el uso se registró al crear el pedido).
    expect(coupon!.usedCount).toBe(0);
    expect(usages).toBe(0);
  });
});
