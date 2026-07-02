import { z } from "zod";

// RFC 5321 §4.5.3: local part ≤ 64 chars, domain label ≤ 63 chars,
// TLD ≥ 2 chars (no numbers). No espacios ni arroba dentro de cada segmento.
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@.]{2,63}$/;

// Zod schema para email opcional (vacío → null). Acepta "" para campos no requeridos.
export const emailOptional = z
  .string()
  .trim()
  .refine((v) => v === "" || EMAIL_RE.test(v), "Email inválido");

// Zod schema para email requerido.
export const emailRequired = z
  .string()
  .trim()
  .min(1, "El email es requerido")
  .refine((v) => EMAIL_RE.test(v), "Email inválido");
