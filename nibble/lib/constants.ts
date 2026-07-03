/**
 * Constantes compartidas del producto.
 *
 * Acá viven valores que se repiten en múltiples archivos y que tiene sentido
 * cambiar coordinadamente. NO meter cosas que un dev individual decide caso
 * a caso (ej. timeouts específicos de un endpoint) — eso vive con su lógica.
 */

/**
 * Largo máximo para passwords en flows de signup/login/recovery/admin-create.
 * 128 chars es generoso para passphrases (Bitwarden default es 64 con
 * separadores) sin permitir DoS por bcrypt sobre strings de MB.
 */
export const MAX_PASSWORD_LENGTH = 128;

// NOTA: hubo constantes LOCALE / MAX_NOTES_LENGTH / MAX_FULL_NAME_LENGTH /
// MAX_EMAIL_LENGTH pero ningún schema las consumía — los límites viven como
// literales junto a cada schema Zod (ej. `.max(500)` en customerNotes).
// Si algún límite empieza a repetirse en 3+ lugares, centralizarlo acá.
