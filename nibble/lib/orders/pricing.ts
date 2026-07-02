/**
 * Cálculo de precios de una orden — función PURA extraída de
 * `createOrderAction` (server/actions/orders.ts) para poder testearla
 * exhaustivamente sin la DB ni el contexto de request de Next.
 *
 * La action sigue siendo dueña de:
 *   - Recalcular `subtotal` desde `product.basePrice` (server-authoritative).
 *   - Resolver el `deliveryFee` desde la geometría de zonas.
 *   - VALIDAR el cupón (existe, activo, fechas, usageLimit, minOrderAmount,
 *     usageLimitPerUser) — esos checks devuelven `fieldErrors` y tocan DB.
 *
 * Esta función solo hace la ARITMÉTICA una vez que esos inputs ya están
 * resueltos y validados. El orden de las operaciones es crítico y replica
 * exactamente el comportamiento original — ver los comentarios inline.
 */

export type CouponForPricing = {
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  /** Monto fijo (FIXED_AMOUNT) o porcentaje 0-100 (PERCENTAGE). */
  value: number;
  /** Tope de ahorro del cupón, o null si no tiene. */
  maxDiscountAmount: number | null;
};

export type PricingInput = {
  subtotal: number;
  /** Fee de envío ya resuelto (null si pickup o sin fee). */
  deliveryFee: number | null;
  deliveryMethod: "delivery" | "pickup";
  /** Cupón ya validado, o null si no se aplicó ninguno. */
  coupon: CouponForPricing | null;
  /** Umbral de la tienda para envío gratis, o null. */
  freeDeliveryAbove: number | null;
};

export type PricingResult = {
  /** Descuento total (producto + envío gratis por cupón), clampeado a subtotal. */
  discountAmount: number;
  /** Fee de envío final tras cupones/umbral (null si pickup). */
  deliveryFee: number | null;
  /** Total a cobrar, redondeado a 2 decimales y nunca negativo. */
  total: number;
};

export function computeOrderPricing(input: PricingInput): PricingResult {
  const { subtotal, deliveryMethod, coupon, freeDeliveryAbove } = input;
  let deliveryFee = input.deliveryFee;

  // discountAmount agrupa descuentos sobre producto + FREE_SHIPPING (el
  // ahorro de envío se contabiliza acá para que el historial de la orden
  // refleje el beneficio del cupón, no solo el total).
  let discountAmount = 0;
  let deliveryDiscountAmount = 0;

  if (coupon) {
    if (coupon.type === "PERCENTAGE") {
      discountAmount = subtotal * (coupon.value / 100);
    } else if (coupon.type === "FIXED_AMOUNT") {
      discountAmount = coupon.value;
    } else if (coupon.type === "FREE_SHIPPING") {
      // Aplica solo si hay envío con costo. Sin delivery o con envío gratis
      // por umbral, el cupón no aporta nada.
      deliveryDiscountAmount = deliveryFee ?? 0;
    }
    // maxDiscountAmount es el tope DEL CUPÓN, sin importar de dónde venga el
    // ahorro. Se aplica a ambos componentes para que un FREE_SHIPPING no
    // cubra el 100% del envío cuando el cupón tiene tope.
    if (coupon.maxDiscountAmount != null) {
      const maxDiscount = coupon.maxDiscountAmount;
      discountAmount = Math.min(discountAmount, maxDiscount);
      deliveryDiscountAmount = Math.min(deliveryDiscountAmount, maxDiscount);
    }
  }

  // freeDeliveryAbove se evalúa DESPUÉS del descuento del cupón sobre
  // producto. Si aplica, anula tanto el deliveryFee como cualquier
  // FREE_SHIPPING ya contabilizado (no doble-descontamos).
  if (
    deliveryMethod === "delivery" &&
    freeDeliveryAbove != null &&
    deliveryFee !== null &&
    subtotal - discountAmount >= freeDeliveryAbove
  ) {
    deliveryFee = 0;
    deliveryDiscountAmount = 0;
  }

  // Reflejar el FREE_SHIPPING como descuento real: el envío final se cobra
  // en cero y el ahorro va a discountAmount.
  if (deliveryDiscountAmount > 0 && deliveryFee !== null) {
    deliveryFee = Math.max(0, deliveryFee - deliveryDiscountAmount);
    discountAmount = discountAmount + deliveryDiscountAmount;
  }

  // Clamp definitivo: el descuento total no puede exceder el subtotal.
  // Aplicado DESPUÉS de sumar deliveryDiscountAmount para cubrir el caso
  // donde un cupón con tope alto + FREE_SHIPPING inflan discountAmount por
  // encima del subtotal y dejarían el total negativo aunque deliveryFee=0.
  discountAmount = Math.min(discountAmount, subtotal);

  // Clampeamos a 0 en vez de error: un cupón válido (FIXED_AMOUNT que cubre
  // subtotal+envío, o redondeos al último centavo) puede dejar el total
  // negativo en el intermedio. Total 0 = "pago cubierto por el descuento".
  const total = Math.max(
    0,
    Math.round((subtotal - discountAmount + (deliveryFee ?? 0)) * 100) / 100,
  );

  return { discountAmount, deliveryFee, total };
}
