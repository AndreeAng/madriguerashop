import "server-only";
import { db } from "@/lib/db";
import { formatBobAmount } from "@/lib/utils";
import type { CouponForPricing } from "./pricing";

/**
 * Validación de cupón contra DB — extraída de `createOrderAction` para que
 * el preview del checkout (`previewCouponAction`) y la creación del pedido
 * usen EXACTAMENTE los mismos checks y mensajes. Si divergen, el cliente
 * paga por QR un monto distinto al que el servidor cobra al confirmar.
 *
 * Esto es fail-fast de UX: el enforcement REAL de `usageLimit` y
 * `usageLimitPerUser` contra pedidos concurrentes vive dentro de la
 * transacción de `createOrderAction`, donde el row-lock del UPDATE de
 * Coupon serializa. Acá solo evitamos entrar a la tx (o dejar pagar al
 * cliente) cuando ya sabemos que el cupón no aplica.
 */

export type CouponValidation =
  | {
      ok: true;
      id: string;
      code: string;
      pricing: CouponForPricing;
    }
  | { ok: false; message: string };

export async function validateCouponForOrder(opts: {
  storeId: string;
  /** Código tal como lo tipeó el cliente; se normaliza a uppercase acá. */
  code: string;
  /** Subtotal del pedido, para `minOrderAmount`. */
  subtotal: number;
  /**
   * Teléfono normalizado del cliente, para `usageLimitPerUser`. Null = se
   * omite el check (preview sin teléfono tipeado aún); la creación del
   * pedido siempre lo pasa y la transacción lo re-verifica de todos modos.
   */
  customerPhone: string | null;
  now?: Date;
}): Promise<CouponValidation> {
  const now = opts.now ?? new Date();

  const coupon = await db.coupon.findUnique({
    where: {
      storeId_code: { storeId: opts.storeId, code: opts.code.toUpperCase() },
    },
  });
  if (!coupon || !coupon.isActive) {
    return { ok: false, message: "Cupón inválido" };
  }
  if (coupon.validFrom > now || coupon.validTo < now) {
    return { ok: false, message: "Cupón fuera de fecha" };
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: "Cupón agotado" };
  }
  if (coupon.minOrderAmount && opts.subtotal < Number(coupon.minOrderAmount)) {
    return {
      ok: false,
      message: `Mínimo de Bs ${formatBobAmount(coupon.minOrderAmount)} para este cupón`,
    };
  }

  if (coupon.usageLimitPerUser && opts.customerPhone) {
    const used = await db.couponUsage.count({
      where: { couponId: coupon.id, customerPhone: opts.customerPhone },
    });
    if (used >= coupon.usageLimitPerUser) {
      return {
        ok: false,
        message:
          coupon.usageLimitPerUser === 1
            ? "Ya usaste este cupón."
            : `Ya usaste este cupón el máximo de ${coupon.usageLimitPerUser} veces.`,
      };
    }
  }

  return {
    ok: true,
    id: coupon.id,
    code: coupon.code,
    pricing: {
      type: coupon.type,
      value: Number(coupon.value),
      maxDiscountAmount:
        coupon.maxDiscountAmount != null
          ? Number(coupon.maxDiscountAmount)
          : null,
    },
  };
}
