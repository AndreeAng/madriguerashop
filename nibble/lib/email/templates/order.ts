import "server-only";
import type { StoreVertical } from "@prisma/client";
import { renderEmail, escapeHtml, safeSubjectField } from "../layout";
import { appUrl } from "../client";
import { formatBob, formatWaPhone } from "@/lib/utils";
import { storefrontCopy } from "@/lib/storefront/copy";
import type { SendInput } from "../send";

/**
 * Sustantivo de pedido capitalizado para el subject del email.
 * Ej. RESTAURANT → "Pedido", SERVICES → "Solicitud", etc.
 */
function orderNounCapitalized(vertical: StoreVertical): string {
  const noun = storefrontCopy(vertical).orderSingular;
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

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
  vertical: StoreVertical;
}): SendInput {
  const paymentLabel = {
    QR_STATIC: "QR (con comprobante)",
    QR_DYNAMIC: "QR dinámico",
    CASH_ON_DELIVERY: "Contra entrega",
  }[opts.paymentMethod];

  const noun = orderNounCapitalized(opts.vertical);
  const nounLower = storefrontCopy(opts.vertical).orderSingular;

  const body = `
    <p>${escapeHtml(opts.ownerName)}, llegó ${nounLower === "solicitud" ? "una" : "un"} ${nounLower} nuev${nounLower === "solicitud" ? "a" : "o"}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; border: 1px solid #e7e3d8; border-radius: 12px;">
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b;">${noun}</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600; text-align: right;">#${opts.orderNumber}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Cliente</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${escapeHtml(opts.customerName)}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Teléfono</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${escapeHtml(opts.customerPhone)}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Items</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${opts.itemsCount}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Pago</td><td style="padding: 12px 16px; font-size: 14px; text-align: right; border-top: 1px solid #e7e3d8;">${escapeHtml(paymentLabel)}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Total</td><td style="padding: 12px 16px; font-size: 18px; font-weight: 600; text-align: right; border-top: 1px solid #e7e3d8;">${formatBob(opts.total)}</td></tr>
    </table>
    ${
      opts.awaitingVerification
        ? `<p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 13px;">
            ⚠ El cliente subió un comprobante. Verifica el pago antes de confirmar.
          </p>`
        : ""
    }
  `;

  return {
    to: opts.to,
    subject: `${noun} #${opts.orderNumber} · ${safeSubjectField(opts.customerName)} · ${formatBob(opts.total)}`,
    html: renderEmail({
      title: `${noun} nuev${nounLower === "solicitud" ? "a" : "o"} #${opts.orderNumber}`,
      body,
      ctaText: `Ver ${nounLower}`,
      ctaUrl: `${appUrl()}/dashboard/pedidos`,
    }),
  };
}

/**
 * Email al cliente cuando su pedido acaba de crearse.
 * Solo se envía si el cliente proporcionó email en el checkout.
 */
export function orderCreatedCustomerEmail(opts: {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: number;
  trackingToken: string;
  total: number;
  paymentMethod: "QR_STATIC" | "QR_DYNAMIC" | "CASH_ON_DELIVERY";
  awaitingVerification: boolean;
  vertical: StoreVertical;
}): SendInput {
  const noun = orderNounCapitalized(opts.vertical);
  const nounLower = storefrontCopy(opts.vertical).orderSingular;
  const isF = nounLower === "solicitud";

  const paymentNote = opts.awaitingVerification
    ? `<p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 13px;">
        Estamos verificando tu comprobante de pago. Te avisamos cuando esté confirmado.
      </p>`
    : opts.paymentMethod === "CASH_ON_DELIVERY"
      ? `<p style="font-size: 14px; color: #6b6b6b;">El pago se cobra al momento de la entrega.</p>`
      : "";

  const body = `
    <p>Recibimos ${isF ? "tu" : "tu"} ${nounLower} en <strong>${escapeHtml(opts.storeName)}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0; border: 1px solid #e7e3d8; border-radius: 12px;">
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b;">${noun}</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600; text-align: right;">#${opts.orderNumber}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #6b6b6b; border-top: 1px solid #e7e3d8;">Total</td><td style="padding: 12px 16px; font-size: 18px; font-weight: 600; text-align: right; border-top: 1px solid #e7e3d8;">${formatBob(opts.total)}</td></tr>
    </table>
    ${paymentNote}
    <p style="font-size: 13px; color: #6b6b6b;">Puedes seguir el estado de tu ${nounLower} con el botón de abajo.</p>
  `;

  return {
    to: opts.to,
    subject: `${noun} #${opts.orderNumber} recibido · ${safeSubjectField(opts.storeName)}`,
    html: renderEmail({
      title: `${isF ? "Solicitud" : "Pedido"} recibid${isF ? "a" : "o"} ✓`,
      body,
      ctaText: `Seguir mi ${nounLower}`,
      ctaUrl: `${appUrl()}/${opts.storeSlug}/orden/${opts.trackingToken}`,
      footnote: `Este email fue enviado porque realizaste un ${nounLower} en ${opts.storeName} a través de Madriguera Shop.`,
    }),
  };
}

/**
 * Email al cliente cuando el owner cambia el estado del pedido.
 * Se envía para CONFIRMED, IN_DELIVERY, DELIVERED y CANCELLED.
 */
export function orderStatusChangedCustomerEmail(opts: {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: number;
  trackingToken: string;
  newStatus: "CONFIRMED" | "IN_DELIVERY" | "DELIVERED" | "CANCELLED";
  cancelReason?: string | null;
  vertical: StoreVertical;
}): SendInput {
  const nounLower = storefrontCopy(opts.vertical).orderSingular;
  const isF = nounLower === "solicitud";

  const configs = {
    CONFIRMED: {
      title: `${isF ? "Solicitud confirmada" : "Pedido confirmado"} ✓`,
      subject: `Confirmad${isF ? "a" : "o"} · ${isF ? "Solicitud" : "Pedido"} #${opts.orderNumber}`,
      body: `<p>${isF ? "Tu solicitud" : "Tu pedido"} <strong>#${opts.orderNumber}</strong> en <strong>${escapeHtml(opts.storeName)}</strong> fue confirmad${isF ? "a" : "o"}. Ya lo estamos preparando.</p>`,
    },
    IN_DELIVERY: {
      title: `${isF ? "Tu solicitud está en camino" : "Tu pedido está en camino"} 🛵`,
      subject: `En camino · ${isF ? "Solicitud" : "Pedido"} #${opts.orderNumber}`,
      body: `<p>${isF ? "Tu solicitud" : "Tu pedido"} <strong>#${opts.orderNumber}</strong> de <strong>${escapeHtml(opts.storeName)}</strong> ya salió para entregarse. Pronto llega.</p>`,
    },
    DELIVERED: {
      title: `${isF ? "Solicitud entregada" : "Pedido entregado"} 🎉`,
      subject: `Entregad${isF ? "a" : "o"} · ${isF ? "Solicitud" : "Pedido"} #${opts.orderNumber}`,
      body: `<p>${isF ? "Tu solicitud" : "Tu pedido"} <strong>#${opts.orderNumber}</strong> de <strong>${escapeHtml(opts.storeName)}</strong> fue entregad${isF ? "a" : "o"}. ¡Gracias por tu compra!</p>`,
    },
    CANCELLED: {
      title: `${isF ? "Solicitud cancelada" : "Pedido cancelado"}`,
      subject: `Cancelad${isF ? "a" : "o"} · ${isF ? "Solicitud" : "Pedido"} #${opts.orderNumber}`,
      body: `
        <p>${isF ? "Tu solicitud" : "Tu pedido"} <strong>#${opts.orderNumber}</strong> en <strong>${escapeHtml(opts.storeName)}</strong> fue cancelad${isF ? "a" : "o"}.</p>
        ${opts.cancelReason ? `<p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 14px;"><strong>Motivo:</strong> ${escapeHtml(opts.cancelReason)}</p>` : ""}
        <p style="font-size: 13px; color: #6b6b6b;">Si tienes dudas, contacta directamente a la tienda.</p>
      `,
    },
  };

  const cfg = configs[opts.newStatus];

  return {
    to: opts.to,
    subject: cfg.subject,
    html: renderEmail({
      title: cfg.title,
      body: cfg.body,
      ctaText: `Ver mi ${nounLower}`,
      ctaUrl: `${appUrl()}/${opts.storeSlug}/orden/${opts.trackingToken}`,
      footnote: `Este email fue enviado porque tienes un ${nounLower} activo en ${opts.storeName} a través de Madriguera Shop.`,
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
  vertical: StoreVertical;
}): SendInput {
  const phoneClean = formatWaPhone(opts.storeWhatsapp);
  const noun = orderNounCapitalized(opts.vertical);
  const nounLower = storefrontCopy(opts.vertical).orderSingular;
  const body = `
    <p>Tu pago ${nounLower === "solicitud" ? "de la" : "del"} ${nounLower} <strong>#${opts.orderNumber}</strong> en
    ${escapeHtml(opts.storeName)} no pudo ser verificado.</p>
    <p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 14px;">
      <strong>Motivo:</strong> ${escapeHtml(opts.reason)}
    </p>
    <p>
      Para no perder ${nounLower === "solicitud" ? "la" : "el"} ${nounLower}, contacta a la tienda por WhatsApp y envía un
      comprobante actualizado.
    </p>
    <p style="font-size: 13px;">
      WhatsApp de la tienda:
      <a href="https://wa.me/${phoneClean}">${escapeHtml(opts.storeWhatsapp)}</a>
    </p>
  `;

  return {
    to: opts.to,
    subject: `Pago no verificado · ${noun} #${opts.orderNumber}`,
    html: renderEmail({
      title: "Tu pago no pudo verificarse",
      body,
      ctaText: `Ver mi ${nounLower}`,
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
  vertical: StoreVertical;
}): SendInput {
  const noun = orderNounCapitalized(opts.vertical);
  const nounLower = storefrontCopy(opts.vertical).orderSingular;
  const body = `
    <p>Tu pago ${nounLower === "solicitud" ? "de la" : "del"} ${nounLower} <strong>#${opts.orderNumber}</strong> en
    ${escapeHtml(opts.storeName)} fue confirmado.</p>
    <p>
      Total verificado: <strong>${formatBob(opts.total)}</strong>.
      Ya empezamos a preparar${nounLower === "solicitud" ? "la" : "lo"} — vas a recibir actualizaciones en tu link de seguimiento.
    </p>
  `;

  return {
    to: opts.to,
    subject: `Pago confirmado · ${noun} #${opts.orderNumber}`,
    html: renderEmail({
      title: "¡Pago confirmado!",
      body,
      ctaText: `Seguir mi ${nounLower}`,
      ctaUrl: `${appUrl()}/${opts.storeSlug}/orden/${opts.trackingToken}`,
    }),
  };
}
