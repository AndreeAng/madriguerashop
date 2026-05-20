import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

const GUEST_TOKEN_COOKIE = "nibble_guest_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

/**
 * Lee el guest token de cookie. Devuelve null si no existe.
 * No lo crea — usar `ensureGuestToken` para crear uno si falta.
 */
export async function readGuestToken(): Promise<string | null> {
  const store = await cookies();
  const c = store.get(GUEST_TOKEN_COOKIE);
  return c?.value ?? null;
}

/**
 * Lee el guest token, y si no existe lo crea + setea la cookie.
 * Solo se puede llamar desde Server Actions / Route Handlers (no Server Components puros).
 */
export async function ensureGuestToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_TOKEN_COOKIE);
  if (existing?.value) return existing.value;

  const token = randomBytes(24).toString("base64url");
  store.set(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // `secure: true` siempre. Vercel preview URLs son HTTPS, y el flag no
    // afecta a localhost en dev (los browsers permiten cookies Secure en
    // http://localhost por defecto). Antes la condición `NODE_ENV ===
    // "production"` dejaba staging/preview sin Secure, lo que permite
    // robar la cookie en cualquier mitm de HTTP downgrade en preview.
    secure: true,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return token;
}

