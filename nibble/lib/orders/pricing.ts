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
  /**
   * Descuento total del cupón (producto + envío gratis), para historial y
   * reportes. El componente de producto está clampeado al subtotal; el de
   * envío, al fee cobrado.
   */
  discountAmount: number;
  /**
   * Fee de envío COBRADO (null si pickup). Solo `freeDeliveryAbove` lo pone
   * en 0; un cupón FREE_SHIPPING no lo toca — su ahorro se registra en
   * `discountAmount`. Así el desglose visible siempre cierra:
   *   total = subtotal - discountAmount + (deliveryFee ?? 0)
   */
  deliveryFee: number | null;
  /** Total a cobrar, redondeado a 2 decimales y nunca negativo. */
  total: number;
};

export function computeOrderPricing(input: PricingInput): PricingResult {
  const { subtotal, deliveryMethod, coupon, freeDeliveryAbove } = input;
  let deliveryFee = input.deliveryFee;

  // Los descuentos sobre producto y sobre envío se llevan POR SEPARADO
  // hasta el final, y cada uno se resta de su propia base (subtotal /
  // deliveryFee). Fusionarlos en una sola variable era el bug del doble
  // descuento de FREE_SHIPPING: el ahorro de envío se sumaba a
  // discountAmount (que se resta del subtotal) Y ADEMÁS dejaba el fee en 0
  // — el cliente pagaba `subtotal - fee` en lugar de `subtotal`.
  let productDiscount = 0;
  let deliveryDiscount = 0;

  if (coupon) {
    if (coupon.type === "PERCENTAGE") {
      productDiscount = subtotal * (coupon.value / 100);
    } else if (coupon.type === "FIXED_AMOUNT") {
      productDiscount = coupon.value;
    } else if (coupon.type === "FREE_SHIPPING") {
      // Aplica solo si hay envío con costo. Sin delivery o con envío gratis
      // por umbral, el cupón no aporta nada.
      deliveryDiscount = deliveryFee ?? 0;
    }
    // maxDiscountAmount es el tope DEL CUPÓN, sin importar de dónde venga el
    // ahorro. Se aplica a ambos componentes para que un FREE_SHIPPING no
    // cubra el 100% del envío cuando el cupón tiene tope.
    if (coupon.maxDiscountAmount != null) {
      const maxDiscount = coupon.maxDiscountAmount;
      productDiscount = Math.min(productDiscount, maxDiscount);
      deliveryDiscount = Math.min(deliveryDiscount, maxDiscount);
    }
  }

  // El descuento sobre producto no puede exceder el subtotal (un
  // FIXED_AMOUNT grande no "sobra" hacia el envío ni deja total negativo).
  productDiscount = Math.min(productDiscount, subtotal);

  // freeDeliveryAbove se evalúa DESPUÉS del descuento del cupón sobre
  // producto. Si aplica, anula tanto el deliveryFee como cualquier
  // FREE_SHIPPING ya contabilizado (no doble-descontamos).
  if (
    deliveryMethod === "delivery" &&
    freeDeliveryAbove != null &&
    deliveryFee !== null &&
    subtotal - productDiscount >= freeDeliveryAbove
  ) {
    deliveryFee = 0;
    deliveryDiscount = 0;
  }

  // El descuento de envío no puede exceder el fee que efectivamente se cobra.
  deliveryDiscount = Math.min(deliveryDiscount, deliveryFee ?? 0);

  // discountAmount agrupa ambos componentes para que el historial de la
  // orden refleje el beneficio completo del cupón (reportes de "cuánto me
  // costó este cupón" suman uniforme entre tipos).
  const discountAmount = productDiscount + deliveryDiscount;

  // Cada descuento se resta de SU base: producto del subtotal, envío del
  // fee. Los clamps de arriba garantizan que ninguna resta quede negativa;
  // el Math.max es cinturón y tirantes contra redondeos al último centavo.
  const total = Math.max(
    0,
    Math.round(
      (subtotal - productDiscount + (deliveryFee ?? 0) - deliveryDiscount) * 100,
    ) / 100,
  );

  return { discountAmount, deliveryFee, total };
}
