import "server-only";
import { renderEmail, escapeHtml } from "../layout";
import { appUrl } from "../client";
import { formatBob, formatWaPhone } from "@/lib/utils";
import type { SendInput } from "../send";

/**
 * Email al owner cuando entra un pedido nuevo.
 * Diseño: directo y operativo — el owner está cocinando, no leyendo poesía.
 */
export function orderCreatedOwnerEmail(opts: {
  to: string;
  ownerName: string;
  storeSlug: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentMethod: "QR_STATIC" | "QR_DYNAMIC" | "CASH_ON_DELIVERY";
  awaitingVerification: boolean;
  itemsCount: number;
}): SendInput {
  const paymentLabel = {
    QR_STATIC: "QR (con comprobante)",
    QR_DYNAMIC: "QR dinámico",
    CASH_ON_DELIVERY: "Contra entrega",
  }[opts.paymentMethod];

  const body = `
    <p>${escapeHtml(opts.ownerName)}, llegó un pedido nuevo.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; border: 1px solid #e7e3d8; border-radius: 12px;">
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b;">Pedido</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600; text-align: right;">#${opts.orderNumber}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Cliente</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${escapeHtml(opts.customerName)}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Teléfono</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${escapeHtml(opts.customerPhone)}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Items</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${opts.itemsCount}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Pago</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${escapeHtml(paymentLabel)}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Total</td><td style="padding: 12px 16px; font-size: 18px; font-weight: 600; text-align: right; border-top: 1px solid #e7e3d8;">${formatBob(opts.total)}</td></tr>
    </table>
    ${
      opts.awaitingVerification
        ? `<p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 13px;">
            ⚠ El cliente subió un comprobante. Verificá el pago antes de confirmar.
          </p>`
        : ""
    }
  `;

  return {
    to: opts.to,
    subject: `Pedido #${opts.orderNumber} · ${opts.customerName} · ${formatBob(opts.total)}`,
    html: renderEmail({
      title: `Pedido nuevo #${opts.orderNumber}`,
      body,
      ctaText: "Ver pedido",
      ctaUrl: `${appUrl()}/dashboard/pedidos`,
    }),
  };
}

/**
 * Email al cliente cuando el owner rechaza el pago (ej. comprobante ilegible).
 */
export function paymentRejectedCustomerEmail(opts: {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: number;
  trackingToken: string;
  reason: string;
  storeWhatsapp: string;
}): SendInput {
  const phoneClean = formatWaPhone(opts.storeWhatsapp);
  const body = `
    <p>Tu pago del pedido <strong>#${opts.orderNumber}</strong> en
    ${escapeHtml(opts.storeName)} no pudo ser verificado.</p>
    <p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 14px;">
      <strong>Motivo:</strong> ${escapeHtml(opts.reason)}
    </p>
    <p>
      Para no perder el pedido, contactá a la tienda por WhatsApp y enviá un
      comprobante actualizado.
    </p>
    <p style="font-size: 13px;">
      WhatsApp de la tienda:
      <a href="https://wa.me/${phoneClean}">${escapeHtml(opts.storeWhatsapp)}</a>
    </p>
  `;

  return {
    to: opts.to,
    subject: `Pago no verificado · Pedido #${opts.orderNumber}`,
    html: renderEmail({
      title: "Tu pago no pudo verificarse",
      body,
      ctaText: "Ver mi pedido",
      ctaUrl: `${appUrl()}/${opts.storeSlug}/orden/${opts.trackingToken}`,
    }),
  };
}

/**
 * Email al cliente cuando el owner verifica el pago.
 */
export function paymentVerifiedCustomerEmail(opts: {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: number;
  trackingToken: string;
  total: number;
}): SendInput {
  const body = `
    <p>Tu pago del pedido <strong>#${opts.orderNumber}</strong> en
    ${escapeHtml(opts.storeName)} fue confirmado.</p>
    <p>
      Total verificado: <strong>${formatBob(opts.total)}</strong>.
      Ya empezamos a prepararlo — vas a recibir actualizaciones en tu link de seguimiento.
    </p>
  `;

  return {
    to: opts.to,
    subject: `Pago confirmado · Pedido #${opts.orderNumber}`,
    html: renderEmail({
      title: "¡Pago confirmado!",
      body,
      ctaText: "Seguir mi pedido",
      ctaUrl: `${appUrl()}/${opts.storeSlug}/orden/${opts.trackingToken}`,
    }),
  };
}
