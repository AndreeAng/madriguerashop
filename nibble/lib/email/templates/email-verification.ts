import "server-only";
import { renderEmail, escapeHtml } from "../layout";
import type { SendInput } from "../send";

export function emailVerificationEmail(opts: {
  to: string;
  verifyUrl: string;
  storeName: string;
}): SendInput {
  const body = `
    <p>
      ¡Bienvenido a Madriguera Shop! Confirmá tu email para activar las
      notificaciones de pedidos, recordatorios de facturación y reset de
      contraseña de <strong>${escapeHtml(opts.storeName)}</strong>.
    </p>
    <p>
      Este link es válido por <strong>24 horas</strong>. Si no fuiste vos,
      ignora este email — tu cuenta queda en estado normal igualmente.
    </p>
  `;

  return {
    to: opts.to,
    subject: "Confirmá tu email — Madriguera Shop",
    html: renderEmail({
      title: "Confirmá tu email",
      body,
      ctaText: "Verificar mi email",
      ctaUrl: opts.verifyUrl,
    }),
  };
}
