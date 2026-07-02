import { describe, it, expect } from "vitest";
import {
  computeOrderPricing,
  type CouponForPricing,
} from "@/lib/orders/pricing";

// El camino del dinero. Estos tests fijan la aritmética exacta de totales,
// descuentos, cupones y envío que antes vivía embebida en createOrderAction.
// Cada valor esperado está calculado a mano en el comentario del caso.

const pct = (value: number, max: number | null = null): CouponForPricing => ({
  type: "PERCENTAGE",
  value,
  maxDiscountAmount: max,
});
const fixed = (value: number, max: number | null = null): CouponForPricing => ({
  type: "FIXED_AMOUNT",
  value,
  maxDiscountAmount: max,
});
const freeShip = (max: number | null = null): CouponForPricing => ({
  type: "FREE_SHIPPING",
  value: 0,
  maxDiscountAmount: max,
});

describe("computeOrderPricing — sin cupón", () => {
  it("pickup: total = subtotal", () => {
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: null,
      deliveryMethod: "pickup",
      coupon: null,
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: null, total: 100 });
  });

  it("delivery con fee: total = subtotal + fee", () => {
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: null,
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: 10, total: 110 });
  });
});

describe("computeOrderPricing — cupón PERCENTAGE", () => {
  it("20% sobre 100 con envío 10 → descuento 20, total 90", () => {
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: pct(20),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 20, deliveryFee: 10, total: 90 });
  });

  it("maxDiscountAmount topea el porcentaje (50% de 100 con tope 15)", () => {
    // discount = min(50, 15) = 15 → total = 100 - 15 = 85
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: null,
      deliveryMethod: "pickup",
      coupon: pct(50, 15),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 15, deliveryFee: null, total: 85 });
  });

  it("redondea a 2 decimales (10% de 33.33 → total 30.00)", () => {
    // discount = 3.333 → total = round((33.33 - 3.333) * 100)/100 = 30
    const r = computeOrderPricing({
      subtotal: 33.33,
      deliveryFee: null,
      deliveryMethod: "pickup",
      coupon: pct(10),
      freeDeliveryAbove: null,
    });
    expect(r.total).toBe(30);
  });
});

describe("computeOrderPricing — cupón FIXED_AMOUNT", () => {
  it("resta el monto fijo", () => {
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: fixed(30),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 30, deliveryFee: 10, total: 80 });
  });

  it("clampa el descuento al subtotal (fixed 50 sobre subtotal 10)", () => {
    // discount = min(50, 10) = 10 → total = 10 - 10 + 5 = 5
    const r = computeOrderPricing({
      subtotal: 10,
      deliveryFee: 5,
      deliveryMethod: "delivery",
      coupon: fixed(50),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 10, deliveryFee: 5, total: 5 });
  });

  it("nunca deja el total negativo (fixed cubre todo, pickup)", () => {
    // discount = min(50,10)=10 → total = max(0, 10-10+0) = 0
    const r = computeOrderPricing({
      subtotal: 10,
      deliveryFee: null,
      deliveryMethod: "pickup",
      coupon: fixed(50),
      freeDeliveryAbove: null,
    });
    expect(r.total).toBe(0);
  });
});

describe("computeOrderPricing — cupón FREE_SHIPPING", () => {
  it("pone el envío en 0 y contabiliza el ahorro como descuento", () => {
    // deliveryDiscount = 10 → fee = 0, discount = 10 → total = 100 - 10 + 0 = 90
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: freeShip(),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 10, deliveryFee: 0, total: 90 });
  });

  it("maxDiscountAmount topea el ahorro de envío (fee 10, tope 5)", () => {
    // deliveryDiscount = min(10,5)=5 → fee = 10-5 = 5, discount = 5
    // total = 100 - 5 + 5 = 100
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: freeShip(5),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 5, deliveryFee: 5, total: 100 });
  });

  it("no aporta nada en pickup (sin fee)", () => {
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: null,
      deliveryMethod: "pickup",
      coupon: freeShip(),
      freeDeliveryAbove: null,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: null, total: 100 });
  });
});

describe("computeOrderPricing — freeDeliveryAbove (umbral de la tienda)", () => {
  it("si el neto alcanza el umbral, el envío es gratis", () => {
    // sin cupón: 100 - 0 >= 50 → fee = 0 → total = 100
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: null,
      freeDeliveryAbove: 50,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: 0, total: 100 });
  });

  it("si el neto NO alcanza el umbral, se cobra el envío", () => {
    // 40 - 0 >= 50 ? no → fee = 10 → total = 50
    const r = computeOrderPricing({
      subtotal: 40,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: null,
      freeDeliveryAbove: 50,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: 10, total: 50 });
  });

  it("el descuento del cupón baja el neto y puede DESACTIVAR el envío gratis", () => {
    // 20% de 100 = 20 → neto 80. Umbral 90: 80 >= 90? no → envío se cobra.
    // total = 100 - 20 + 10 = 90
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: pct(20),
      freeDeliveryAbove: 90,
    });
    expect(r).toEqual({ discountAmount: 20, deliveryFee: 10, total: 90 });
  });

  it("pickup ignora el umbral de envío gratis", () => {
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: null,
      deliveryMethod: "pickup",
      coupon: null,
      freeDeliveryAbove: 50,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: null, total: 100 });
  });

  it("freeDeliveryAbove tiene prioridad sobre FREE_SHIPPING (no doble-descuento)", () => {
    // Umbral alcanzado → fee=0 y deliveryDiscount se resetea a 0.
    // El FREE_SHIPPING no agrega ahorro adicional. discount=0, total=100.
    const r = computeOrderPricing({
      subtotal: 100,
      deliveryFee: 10,
      deliveryMethod: "delivery",
      coupon: freeShip(),
      freeDeliveryAbove: 50,
    });
    expect(r).toEqual({ discountAmount: 0, deliveryFee: 0, total: 100 });
  });
});
