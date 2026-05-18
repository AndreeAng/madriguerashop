/**
 * Validación y normalización de slugs de tienda.
 *
 * El slug es parte de la URL pública: `madrigueras.app/<slug>`.
 * Por eso debe:
 *  - No colisionar con rutas top-level del App Router (admin, api, dashboard, login, etc).
 *  - Ser legible y "marca-friendly".
 *  - Cumplir formato URL-safe (a-z, 0-9, guión).
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
//                ^                ^                ^
//   debe empezar  cuerpo opcional  debe terminar
//   alfanum.      letras/dígitos/   alfanum.
//                 guión

const MIN_LEN = 3;
const MAX_LEN = 32;

/**
 * Lista de slugs reservados. Incluye:
 *  - Rutas top-level del App Router (no se pueden pisar)
 *  - Palabras de marca / sistema que queremos guardarnos
 *  - Términos genéricos que un cliente podría querer pero confunden
 *
 * Mantener en orden alfabético para facilitar revisión.
 */
const RESERVED_SLUGS = new Set<string>([
  // Rutas del app
  "_next",
  "admin",
  "api",
  "auth",
  "checkout",
  "dashboard",
  "login",
  "logout",
  "orden",
  "ordenes",
  "p",
  "public",
  "recovery",
  "registro",
  "settings",
  "static",
  "tiendas",
  "uploads",

  // Marca / sistema
  "about",
  "ayuda",
  "blog",
  "contacto",
  "docs",
  "help",
  "legal",
  "madriguera",
  "madrigueras",
  "madriguerashop",
  "nibble",
  "privacidad",
  "privacy",
  "soporte",
  "support",
  "terminos",
  "terms",
]);

export type SlugValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: SlugInvalidReason };

export type SlugInvalidReason =
  | "empty"
  | "too_short"
  | "too_long"
  | "bad_format"
  | "reserved";

/**
 * Normaliza un texto a un slug candidato.
 * No valida — sólo prepara el input para validación.
 *
 *  "Big Bite Wings" → "big-bite-wings"
 *  "Café André"      → "cafe-andre"
 *  "  --hola--  "    → "hola"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remueve acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // todo lo no-alfanum → guión
    .replace(/^-+|-+$/g, "") // sin guiones al borde
    .replace(/-{2,}/g, "-"); // sin guiones consecutivos
}

/**
 * Valida un slug ya normalizado. Retorna `{ ok, value | reason }`.
 * Es la función a usar antes de tocar la DB.
 */
export function validateSlug(input: string): SlugValidationResult {
  const value = input.trim().toLowerCase();
  if (!value) return { ok: false, reason: "empty" };
  if (value.length < MIN_LEN) return { ok: false, reason: "too_short" };
  if (value.length > MAX_LEN) return { ok: false, reason: "too_long" };
  if (!SLUG_RE.test(value)) return { ok: false, reason: "bad_format" };
  if (RESERVED_SLUGS.has(value)) return { ok: false, reason: "reserved" };
  return { ok: true, value };
}

export function slugErrorMessage(reason: SlugInvalidReason): string {
  switch (reason) {
    case "empty":
      return "Ingresa un identificador para tu tienda.";
    case "too_short":
      return `Mínimo ${MIN_LEN} caracteres.`;
    case "too_long":
      return `Máximo ${MAX_LEN} caracteres.`;
    case "bad_format":
      return "Sólo letras, números y guiones. Sin espacios ni acentos.";
    case "reserved":
      return "Este nombre está reservado. Prueba con otro.";
  }
}
