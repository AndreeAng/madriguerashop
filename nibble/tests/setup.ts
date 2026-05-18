/**
 * Setup global para los tests unit.
 *
 * Forzamos `TZ=UTC` para que los tests de timezone (availability, slots,
 * billing) corran SIEMPRE con el server pretendiendo estar en UTC —
 * que es el caso real en Vercel y la condición bajo la que vivía el
 * bug original de `getDay()` evaluando contra el día equivocado.
 *
 * Si lo dejaras al TZ del sistema local del dev, un developer en Bolivia
 * (UTC-4) vería tests verdes con código buggy porque su `getDay()`
 * accidentalmente coincide con `inBolivia()`. En CI/Vercel los mismos
 * tests fallarían y nadie sabría por qué.
 *
 * Node 16+ permite cambiar `process.env.TZ` antes de instanciar Date y
 * la zona se aplica a partir de ese momento. Vitest carga este archivo
 * antes que cualquier test, así que la asignación llega a tiempo.
 */
process.env.TZ = "UTC";
