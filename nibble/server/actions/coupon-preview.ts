"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant/resolve";
import { readGuestToken } from "@/lib/cart/cookies";
import {
  rateLimit,
  getClientIp,
  rateLimitErrorMessage,
} from "@/lib/security/rateLimit";
import { normalizePhoneBO, PHONE_BO_RE } from "@/lib/auth/identifiers";
import { validateCouponForOrder } from "@/lib/orders/coupon";
import type { CouponForPricing } from "@/lib/orders/pricing";

/**
 * Preview de cupón para el checkout — el flujo QR es "pagar → subir
 * comprobante → confirmar", así que el cliente necesita saber el total CON
 * cupón ANTES de escanear el QR. Sin este preview, pagaba el monto sin
 * descuento y el comprobante no coincidía con el total de la orden.
 *
 * Devuelve los primitivos del cupón validado; el cliente calcula el total
 * con `computeOrderPricing` — la MISMA función pura que usa
 * `createOrderAction` al cobrar, así el preview no puede divergir del cobro
 * (para el mismo subtotal, zona y método de entrega).
 *
 * La creación del pedido re-valida todo de cero: este preview es solo UX,
 * no autoriza nada.
 */

export type PreviewCouponResult =
  | { ok: { code: string } & CouponForPricing }
  | { error: string };

const previewSchema = z.object({
  storeSlug: z.string().min(1).max(80),
  couponCode: z.string().trim().min(1).max(40),
  customerPhone: z.string().trim().max(30).optional(),
});

export async function previewCouponAction(
  input: z.infer<typeof previewSchema>,
): Promise<PreviewCouponResult> {
  // Rate limit por IP: el vector de abuso es adivinar códigos por fuerza
  // bruta. Un cliente legítimo prueba 1-3 códigos; 10 intentos / 5 min
  // deja margen sin habilitar enumeración.
  const ip = await getClientIp();
  const rl = await rateLimit(`coupon-preview:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
  }

  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Cupón inválido" };
  }
  const data = parsed.data;

  const store = await getStoreBySlug(data.storeSlug);
  if (!store || store.status === "SUSPENDED" || store.status === "CANCELLED") {
    return { error: "Esta tienda no está aceptando pedidos en este momento." };
  }

  // Subtotal desde el carrito del guest — la misma base que el cliente ve
  // en el resumen (snapshot de unitPrice). `createOrderAction` recalcula
  // con precios frescos al confirmar; si el owner cambió un precio entre
  // medio, la re-validación final manda.
  const guestToken = await readGuestToken();
  if (!guestToken) {
    return { error: "Tu carrito está vacío. Vuelve al menú." };
  }
  const cart = await db.cart.findFirst({
    where: { storeId: store.id, guestToken, expiresAt: { gt: new Date() } },
    include: { items: { select: { unitPrice: true, quantity: true } } },
  });
  if (!cart || cart.items.length === 0) {
    return { error: "Tu carrito está vacío. Vuelve al menú." };
  }
  const subtotal = cart.items.reduce(
    (s, i) => s + Number(i.unitPrice) * i.quantity,
    0,
  );

  // Teléfono opcional para el check de usageLimitPerUser. Si el cliente
  // aún no lo tipeó (o está malformado), se omite — la creación del pedido
  // lo re-verifica siempre con el teléfono definitivo.
  const rawPhone = (data.customerPhone ?? "").replace(/[\s-]/g, "");
  const customerPhone = PHONE_BO_RE.test(rawPhone)
    ? normalizePhoneBO(rawPhone)
    : null;

  const validated = await validateCouponForOrder({
    storeId: store.id,
    code: data.couponCode,
    subtotal,
    customerPhone,
  });
  if (!validated.ok) {
    return { error: validated.message };
  }

  return { ok: { code: validated.code, ...validated.pricing } };
}
