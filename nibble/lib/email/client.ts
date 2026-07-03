import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Singleton del transport de SMTP.
 *
 * Si las credenciales no están seteadas (típicamente en dev), retorna null y
 * el `send()` cae a modo "log a stdout" — útil para desarrollo sin SMTP real.
 */

let cached: Transporter | null | undefined;

export function getMailTransport(): Transporter | null {
  if (cached !== undefined) return cached;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    cached = null;
    return null;
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Exigir TLS 1.2+ y validar el cert del servidor SMTP. Sin estos flags,
    // nodemailer hace STARTTLS pero puede caer a texto claro si el server
    // no lo soporta — riesgo de interceptación de tokens de recovery.
    requireTLS: port !== 465,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  return cached;
}

export function mailFrom(): string {
  return process.env.SMTP_FROM || `Madriguera Shop <no-reply@${appHostname()}>`;
}

function appHostname(): string {
  // `||` para que APP_URL="" no quede como string vacío.
  const url = process.env.APP_URL || "http://localhost:3000";
  try {
    return new URL(url).hostname;
  } catch {
    return "madrigueras.shop";
  }
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
