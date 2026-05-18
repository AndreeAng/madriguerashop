import "server-only";

/**
 * Layout HTML compartido por todos los emails.
 *
 * Diseño: tabla-based (única forma confiable cross-client), inline styles
 * (Gmail, Outlook strippean estilos en <style>), max-width 600px (estándar
 * email), fuentes web-safe.
 *
 * Uso:
 *   renderEmail({ title: "Bienvenido", body: "<p>Hola...</p>", footer: ... })
 */

export type EmailLayoutInput = {
  title: string;
  /**
   * HTML del cuerpo (entre el header y el footer).
   *
   * ⚠️ CONTRATO: el caller es RESPONSABLE de escapar todas las variables
   * user-controlled antes de armar este string. `renderEmail` lo inserta
   * raw (no escapa, no sanitiza). Usá `escapeHtml(value)` sobre cada
   * variable que venga del usuario (customerName, customerNotes,
   * productName, storeName, etc.).
   *
   * Por qué no auto-escapar: el body es composable — armás `<p>${escapeHtml(name)}</p>`
   * y necesitás que los tags `<p>` queden literales. Auto-escape rompería
   * el HTML. La convención en todos los templates de `lib/email/templates/`
   * es escapar variables individualmente; si agregás un nuevo template,
   * seguí esa misma convención.
   */
  body: string;
  /** Texto del CTA principal (opcional). */
  ctaText?: string;
  ctaUrl?: string;
  /** Línea de pie de página (default: nombre del producto + año). */
  footnote?: string;
};

const COLOR_BG = "#f7f5f0";
const COLOR_CARD = "#ffffff";
const COLOR_TEXT = "#1a1410";
const COLOR_MUTED = "#6b6b6b";
const COLOR_AMBER = "#f59e0b";
const COLOR_BARK = "#1a1410";

export function renderEmail(input: EmailLayoutInput): string {
  const cta =
    input.ctaText && input.ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
          <tr>
            <td style="border-radius: 999px; background: ${COLOR_BARK};">
              <a href="${escapeHtml(input.ctaUrl)}"
                 style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 999px;">
                ${escapeHtml(input.ctaText)}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; color: ${COLOR_TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BG};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: ${COLOR_CARD}; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <span style="display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: ${COLOR_AMBER};">
                madriguera·shop
              </span>
              <h1 style="margin: 12px 0 0 0; font-size: 28px; font-weight: 600; line-height: 1.2; color: ${COLOR_TEXT};">
                ${escapeHtml(input.title)}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 20px 32px 8px 32px; font-size: 15px; line-height: 1.6; color: ${COLOR_TEXT};">
              ${input.body}
              ${cta}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 32px 32px; border-top: 1px solid #e7e3d8; font-size: 12px; line-height: 1.5; color: ${COLOR_MUTED};">
              ${escapeHtml(
                input.footnote ?? "Madriguera Shop · Plataforma hecha por Nibble hecha en Bolivia.",
              )}
              <br>
              <span style="font-size: 11px;">© ${new Date().getFullYear()} Madriguera Shop · Cochabamba, Bolivia</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
