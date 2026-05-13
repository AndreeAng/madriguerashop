import "server-only";
import { renderEmail, escapeHtml } from "../layout";
import { appUrl } from "../client";
import { formatBob } from "@/lib/utils";
import type { SendInput } from "../send";

export function invoiceIssuedEmail(opts: {
  to: string;
  storeName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
}): SendInput {
  const due = opts.dueDate.toLocaleDateString("es-BO", { dateStyle: "medium" });

  const body = `
    <p>Hola ${escapeHtml(opts.storeName)},</p>
    <p>
      Acabamos de emitir tu factura <strong>${escapeHtml(opts.invoiceNumber)}</strong>
      por <strong>${formatBob(opts.amount)}</strong>. Vence el ${escapeHtml(due)}.
    </p>
    <p>
      Pagas escaneando nuestro QR desde tu panel de facturación. Una vez que
      transfieras, subes el comprobante y verificamos en máximo 24 hs.
    </p>
  `;

  return {
    to: opts.to,
    subject: `Factura ${opts.invoiceNumber} · ${formatBob(opts.amount)} — Madriguera Shop`,
    html: renderEmail({
      title: `Factura ${opts.invoiceNumber}`,
      body,
      ctaText: "Pagar mi factura",
      ctaUrl: `${appUrl()}/dashboard/facturacion`,
    }),
  };
}

export function invoicePaidEmail(opts: {
  to: string;
  storeName: string;
  invoiceNumber: string;
  amount: number;
}): SendInput {
  const body = `
    <p>Hola ${escapeHtml(opts.storeName)},</p>
    <p>
      Confirmamos el pago de tu factura <strong>${escapeHtml(opts.invoiceNumber)}</strong>
      por <strong>${formatBob(opts.amount)}</strong>.
    </p>
    <p>
      Tu tienda sigue activa sin interrupciones. ¡Gracias por confiar en Madriguera Shop!
    </p>
  `;

  return {
    to: opts.to,
    subject: `Pago confirmado · ${opts.invoiceNumber} — Madriguera Shop`,
    html: renderEmail({
      title: "Recibimos tu pago",
      body,
      ctaText: "Ver mi dashboard",
      ctaUrl: `${appUrl()}/dashboard`,
    }),
  };
}
