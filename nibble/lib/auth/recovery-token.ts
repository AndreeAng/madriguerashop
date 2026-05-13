import "server-only";
import crypto from "node:crypto";

// Tokens de password reset: el plano se envía por email; en DB guardamos
// solo el hash SHA-256. Esto previene que un leak de la tabla PasswordReset
// permita usar tokens directamente para tomar cuentas.
//
// SHA-256 sin salt es seguro acá porque el plano es 32 bytes random
// (256 bits de entropía) — fuerza bruta es inviable y no necesitamos
// resistencia a diccionarios como en passwords humanas.

const TOKEN_BYTES = 32;
const HASH_HEX_LEN = 64; // SHA-256 → 32 bytes → 64 hex chars

export function generateRecoveryTokenPlain(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashRecoveryToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

/** Validador de formato del token plano (recibido por URL). */
export function isValidRecoveryTokenFormat(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export const RECOVERY_TOKEN_HEX_LEN = HASH_HEX_LEN;
