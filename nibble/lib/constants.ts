/**
 * Constantes compartidas del producto.
 *
 * Acá viven valores que se repiten en múltiples archivos y que tiene sentido
 * cambiar coordinadamente. NO meter cosas que un dev individual decide caso
 * a caso (ej. timeouts específicos de un endpoint) — eso vive con su lógica.
 */

/**
 * Locale del sitio. Bolivia (es-BO) — la app no soporta multi-idioma hoy.
 * Usado por `toLocaleString`, `formatBob`, `formatDateLong`, etc.
 */
export const LOCALE = "es-BO";

/**
 * Largo máximo para passwords en flows de signup/login/recovery/admin-create.
 * 128 chars es generoso para passphrases (Bitwarden default es 64 con
 * separadores) sin permitir DoS por bcrypt sobre strings de MB.
 */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Largo máximo para notas de cliente en checkout, bookings, cart items.
 * 500 chars cubre 3-4 frases razonables; más largo es típicamente spam o
 * el cliente confundiendo el campo notes con un chat.
 */
export const MAX_NOTES_LENGTH = 500;

/**
 * Largo máximo para nombres "humanos" (nombre completo, fullName).
 * 80 es suficiente para nombres compuestos boliviano-españoles (incluso
 * múltiples apellidos) y deja headroom razonable.
 */
export const MAX_FULL_NAME_LENGTH = 80;

/**
 * Largo máximo para emails. RFC 5321 dice 320, pero en práctica >120 es
 * casi siempre input mal pegado.
 */
export const MAX_EMAIL_LENGTH = 120;
