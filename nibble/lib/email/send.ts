import "server-only";
import { getMailTransport, mailFrom } from "./client";

export type SendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Email desde el cual se envía. Default: SMTP_FROM. */
  from?: string;
  /** Reply-to opcional — útil para que respondan al owner, no al SMTP. */
  replyTo?: string;
};

type SendResult =
  | { delivered: true; messageId: string }
  | { delivered: false; reason: "no_smtp" | "send_failed"; error?: string };

/**
 * Envía un email. Si SMTP no está configurado, loggea a stdout y retorna
 * `delivered: false, reason: "no_smtp"` — la action que llama puede decidir
 * si tratarlo como error o seguir.
 *
 * En producción, SMTP_HOST/USER/PASS deben estar seteados o los emails
 * críticos (recovery, verificación) van a fallar silenciosamente.
 */
export async function sendEmail(input: SendInput): Promise<SendResult> {
  const transport = getMailTransport();
  const from = input.from ?? mailFrom();

  if (!transport) {
    // Dev mode — loggear lo que se hubiera enviado, sin filtrar PII del body.
    // El body típicamente contiene reset URLs con tokens, links de
    // verificación, datos de pedido, etc. En dev local con un dev mirando
    // su propio stdout es OK; pero estos logs también suelen terminar en
    // log aggregators (Vercel/Datadog). Mejor loguear sólo metadatos.
    console.log("[email:no-smtp]", {
      from,
      // Hash del destinatario en lugar del email/teléfono completo. Suficiente
      // para correlacionar en debug; sin filtrar PII al sistema de logs.
      toHash: redactRecipient(input.to),
      subject: input.subject,
      hasReplyTo: !!input.replyTo,
    });
    return { delivered: false, reason: "no_smtp" };
  }

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      replyTo: input.replyTo,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email:send_failed]", { to: input.to, subject: input.subject, error: message });
    return { delivered: false, reason: "send_failed", error: message };
  }
}

/**
 * Versión "fire & forget" — se invoca desde acciones donde NO queremos que el
 * envío de email bloquee/falle el flujo principal (ej. crear pedido).
 *
 * Cualquier error queda en console.error y no propaga.
 */
export function sendEmailBackground(input: SendInput): void {
  void sendEmail(input).catch((err) => {
    console.error("[email:background_failed]", err);
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Redacta el destinatario para logs: primer carácter + dominio, ej:
 * `juan@gmail.com` → `j***@gmail.com`. Suficiente para correlacionar
 * eventos en debug, sin filtrar el email/teléfono completo al sistema
 * de logs.
 */
function redactRecipient(to: string): string {
  if (to.includes("@")) {
    const [local, domain] = to.split("@");
    if (!local || !domain) return "[redacted]";
    return `${local[0] ?? ""}***@${domain}`;
  }
  // Teléfono u otro identificador: mostrar solo últimos 4 dígitos.
  return `***${to.slice(-4)}`;
}
