import "server-only";
import { renderEmail, escapeHtml, safeSubjectField } from "../layout";
import { appUrl } from "../client";
import { formatBob } from "@/lib/utils";
import type { SendInput } from "../send";

/**
 * Recordatorio de factura próxima a vencer.
 *
 * Tipos:
 *  - "due_soon": faltan días para vencer (3d / 1d antes)
 *  - "due_today": vence hoy
 *  - "overdue": ya venció
 */
export type ReminderKind = "due_soon" | "due_today" | "overdue";

export function invoiceReminderEmail(opts: {
  to: string;
  storeName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  daysUntilDue: number; // negativo si ya venció
  kind: ReminderKind;
}): SendInput {
  const due = opts.dueDate.toLocaleDateString("es-BO", {
    dateStyle: "medium",
    timeZone: "America/La_Paz",
  });

  let title: string;
  let alert: string;
  let body: string;

  switch (opts.kind) {
    case "overdue":
      title = "Tu factura venció";
      alert = "Tu tienda puede ser suspendida si no se regulariza pronto.";
      body = `
        <p>Hola ${escapeHtml(opts.storeName)},</p>
        <p>
          La factura <strong>${escapeHtml(opts.invoiceNumber)}</strong> por
          <strong>${formatBob(opts.amount)}</strong> venció el ${escapeHtml(due)}.
        </p>
        <p style="background: #fee2e2; border-left: 3px solid #dc2626; padding: 10px 12px; margin: 14px 0; font-size: 13px; color: #7f1d1d;">
          ⚠ ${escapeHtml(alert)}
        </p>
        <p>Paga lo antes posible desde tu panel de facturación para evitar la suspensión.</p>
      `;
      break;
    case "due_today":
      title = "Tu factura vence hoy";
      body = `
        <p>Hola ${escapeHtml(opts.storeName)},</p>
        <p>
          La factura <strong>${escapeHtml(opts.invoiceNumber)}</strong> por
          <strong>${formatBob(opts.amount)}</strong> <strong>vence hoy</strong>.
        </p>
        <p>Págala desde tu panel para mantener tu tienda activa.</p>
      `;
      break;
    case "due_soon":
    default:
      title = `Tu factura vence en ${opts.daysUntilDue} ${opts.daysUntilDue === 1 ? "día" : "días"}`;
      body = `
        <p>Hola ${escapeHtml(opts.storeName)},</p>
        <p>
          Te recordamos que la factura
          <strong>${escapeHtml(opts.invoiceNumber)}</strong> por
          <strong>${formatBob(opts.amount)}</strong> vence el ${escapeHtml(due)}.
        </p>
        <p>Págala con tiempo desde tu panel para evitar inconvenientes.</p>
      `;
  }

  return {
    to: opts.to,
    subject: `${title} · ${safeSubjectField(opts.invoiceNumber, 40)}`,
    html: renderEmail({
      title,
      body,
      ctaText: "Ir a facturación",
      ctaUrl: `${appUrl()}/dashboard/facturacion`,
    }),
  };
}

/** Tienda suspendida por falta de pago. */
export function storeSuspendedEmail(opts: {
  to: string;
  storeName: string;
  storeSlug: string;
}): SendInput {
  const body = `
    <p>Hola ${escapeHtml(opts.storeName)},</p>
    <p>
      Tu tienda fue <strong>suspendida</strong> por facturas vencidas sin pago.
      Tu storefront público
      <code>${appUrl()}/${escapeHtml(opts.storeSlug)}</code> ya no es accesible.
    </p>
    <p style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 14px 0; font-size: 13px;">
      Buenas noticias: <strong>tus datos siguen intactos</strong>. Apenas verifiquemos
      el pago, tu tienda vuelve a estar online sin perder nada.
    </p>
    <p>Paga las facturas pendientes para reactivar el servicio.</p>
  `;

  return {
    to: opts.to,
    subject: "Tu tienda fue suspendida — Madriguera Shop",
    html: renderEmail({
      title: "Tu tienda fue suspendida",
      body,
      ctaText: "Pagar facturas pendientes",
      ctaUrl: `${appUrl()}/dashboard/facturacion`,
    }),
  };
}
