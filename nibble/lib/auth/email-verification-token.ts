import "server-only";
import crypto from "node:crypto";

/**
 * Tokens stateless de verificación de email firmados con `AUTH_SECRET`.
 *
 * ¿Por qué stateless y no un model `EmailVerification` como `PasswordReset`?
 * - El flujo es fire-and-forget: el cliente recibe un link y lo clickea o
 *   no. No necesitamos revocar antes del exp ni ver "verificaciones
 *   pendientes" en un dashboard.
 * - Evitamos una migración + tabla nueva. El costo (no poder revocar antes
 *   del exp) es aceptable: si el user resetea password o cambia de email,
 *   se invalida implícitamente porque generamos un token nuevo.
 * - Si el atacante intercepta el link, sólo gana confirmar el email — no
 *   da acceso a la cuenta. Bajo blast radius.
 *
 * Payload: `{ uid, exp }`. Codificado base64url. HMAC-SHA256 con
 * `AUTH_SECRET` previene falsificación.
 *
 * Formato del token: `{base64url(payload)}.{base64url(hmac)}`
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hmac(payload: string): string {
  return b64urlEncode(
    crypto.createHmac("sha256", getSecret()).update(payload).digest(),
  );
}

export function generateEmailVerificationToken(userId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = b64urlEncode(JSON.stringify({ uid: userId, exp }));
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyEmailVerificationToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payload, sig] = parts;
  if (!payload || !sig) return { ok: false, reason: "malformed" };

  // `timingSafeEqual` para no filtrar info por timing en el compare.
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let parsed: { uid?: string; exp?: number };
  try {
    parsed = JSON.parse(b64urlDecode(payload).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!parsed.uid || typeof parsed.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (parsed.exp < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: parsed.uid };
}
