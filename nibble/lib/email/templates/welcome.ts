import "server-only";
import { renderEmail, escapeHtml } from "../layout";
import { appUrl } from "../client";
import type { SendInput } from "../send";

export function welcomeEmail(opts: {
  to: string;
  ownerName: string;
  storeName: string;
  storeSlug: string;
}): SendInput {
  const body = `
    <p>Hola ${escapeHtml(opts.ownerName)},</p>
    <p>
      Tu tienda <strong>${escapeHtml(opts.storeName)}</strong> ya está creada en
      Madriguera Shop. Acabamos de emitir tu primera factura — la encuentras en
      tu panel de facturación.
    </p>
    <p>Lo que te recomendamos hacer ahora:</p>
    <ol style="padding-left: 20px; margin: 12px 0;">
      <li style="margin-bottom: 6px;">Pagar tu primera factura para activar la tienda al público.</li>
      <li style="margin-bottom: 6px;">Subir tu logo, banner y QR de pago.</li>
      <li style="margin-bottom: 6px;">Crear tus categorías y los primeros productos.</li>
      <li style="margin-bottom: 6px;">Compartir tu link <code>${appUrl()}/${escapeHtml(opts.storeSlug)}</code> con tus primeros clientes.</li>
    </ol>
  `;

  const firstName = opts.ownerName.split(" ")[0] ?? opts.ownerName;

  return {
    to: opts.to,
    subject: `Bienvenido a Madriguera Shop, ${opts.ownerName}`,
    html: renderEmail({
      title: `Tu tienda está lista, ${escapeHtml(firstName)}`,
      body,
      ctaText: "Ir a mi dashboard",
      ctaUrl: `${appUrl()}/dashboard`,
    }),
  };
}
