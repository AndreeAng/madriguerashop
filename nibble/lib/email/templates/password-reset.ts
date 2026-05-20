import "server-only";
import { renderEmail, escapeHtml } from "../layout";
import type { SendInput } from "../send";

export function passwordResetEmail(opts: {
  to: string;
  resetUrl: string;
  expiresAt: Date;
}): SendInput {
  const expires = opts.expiresAt.toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const body = `
    <p>
      Recibimos una solicitud para restablecer tu contraseña en Madriguera Shop.
      Haz click en el botón para crear una nueva.
    </p>
    <p>
      Este link es válido hasta el <strong>${escapeHtml(expires)}</strong>.
      Si no fuiste tú, puedes ignorar este email — tu contraseña no cambió.
    </p>
  `;

  return {
    to: opts.to,
    subject: "Restablece tu contraseña — Madriguera Shop",
    html: renderEmail({
      title: "Restablece tu contraseña",
      body,
      ctaText: "Crear nueva contraseña",
      ctaUrl: opts.resetUrl,
    }),
  };
}
