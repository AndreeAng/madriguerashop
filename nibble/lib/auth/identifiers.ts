/**
 * Normalización de identificadores de login.
 * Username puede ser email o teléfono boliviano (+591XXXXXXXX).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?591\d{8}$/;

export type IdentifierKind = "email" | "phone" | "unknown";

/**
 * Normaliza un identifier. Retorna `{ kind, value }` donde value es la versión canónica.
 *
 *  - Email → lowercased + trimmed.
 *  - Phone → con +591 prefix, sin espacios ni guiones. Acepta:
 *    "70012345" (8 dígitos) → "+59170012345"
 *    "591 7001 2345" → "+59170012345"
 *    "+591 7001 2345" → "+59170012345"
 */
export function normalizeIdentifier(input: string): { kind: IdentifierKind; value: string } {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "unknown", value: "" };

  // Email?
  if (EMAIL_RE.test(trimmed)) {
    return { kind: "email", value: trimmed.toLowerCase() };
  }

  // Phone — limpiar todo lo que no sea dígito o +
  const stripped = trimmed.replace(/[^\d+]/g, "");

  // Si son 8 dígitos sin prefijo, asumimos Bolivia (+591)
  if (/^\d{8}$/.test(stripped)) {
    return { kind: "phone", value: `+591${stripped}` };
  }

  // Si empieza con 591 (sin +), agregamos +
  if (/^591\d{8}$/.test(stripped)) {
    return { kind: "phone", value: `+${stripped}` };
  }

  // +591XXXXXXXX
  if (PHONE_RE.test(stripped)) {
    return { kind: "phone", value: stripped.startsWith("+") ? stripped : `+${stripped}` };
  }

  return { kind: "unknown", value: trimmed };
}

/**
 * Valida que un identifier sea email O teléfono BO válido.
 */
export function isValidIdentifier(input: string): boolean {
  const { kind } = normalizeIdentifier(input);
  return kind === "email" || kind === "phone";
}
