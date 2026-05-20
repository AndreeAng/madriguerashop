/**
 * Helpers de fecha + i18n compartidos entre client y server.
 *
 * Antes vivían como copias literales en 4+ archivos (BookingForm,
 * BookingsWeek, reserva/page, analytics/page). Cualquier cambio
 * desincronizaba las copias en silencio.
 *
 * TODAS las funciones que extraen componentes de una fecha lo hacen en
 * hora BOLIVIA (UTC-4) independientemente de la TZ del proceso. En
 * Vercel (UTC), las versiones anteriores usaban `getDate()` / `getHours()`
 * y producían "21 may" para una fecha del 20 may 22:30 BOT — el dashboard
 * mostraba el día equivocado al cliente boliviano. Bolivia no observa DST,
 * así que el offset -4 es estable todo el año.
 *
 * NO depende de `Intl.DateTimeFormat` con locale para evitar mismatches
 * de hydration entre Node y V8 (ICU implementations difieren).
 */

const BOT_OFFSET_MS = -4 * 60 * 60 * 1000;

/** Devuelve un Date "shifted" cuyos métodos UTC reflejan la hora Bolivia. */
function toBoliviaUTC(d: Date): Date {
  return new Date(d.getTime() + BOT_OFFSET_MS);
}

/** Nombres abreviados, índice 0 = domingo (convención `Date.getDay()`). */
export const WEEKDAY_ES_SHORT = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
];

/** Nombres en minúscula para texto corrido ("hoy es lunes …"). */
const WEEKDAY_ES_LOWER = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Meses abreviados (índice 0 = enero). */
export const MONTH_ES_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Meses completos en minúscula — usado por `longDate` para que "12 de may"
 *  no aparezca en emails y tracking del cliente final. */
export const MONTH_ES_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "YYYY-MM-DD" en hora BOLIVIA. Determinista cross-TZ. */
export function ymdLocal(d: Date): string {
  const b = toBoliviaUTC(d);
  return `${b.getUTCFullYear()}-${pad2(b.getUTCMonth() + 1)}-${pad2(b.getUTCDate())}`;
}

/** "10 abr" — fecha corta sin día de semana, en hora Bolivia. */
export function shortDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const b = toBoliviaUTC(d);
  return `${b.getUTCDate()} ${MONTH_ES_SHORT[b.getUTCMonth()] ?? ""}`;
}

/** "vie, 10 abr" — fecha corta con día de semana, en hora Bolivia. */
export function shortDateWithWeekday(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const b = toBoliviaUTC(d);
  return `${WEEKDAY_ES_SHORT[b.getUTCDay()]?.toLowerCase() ?? ""}, ${b.getUTCDate()} ${MONTH_ES_SHORT[b.getUTCMonth()] ?? ""}`;
}

/** "lunes 12 de mayo" — fecha larga, en hora Bolivia. */
export function longDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const b = toBoliviaUTC(d);
  return `${WEEKDAY_ES_LOWER[b.getUTCDay()]} ${b.getUTCDate()} de ${MONTH_ES_LONG[b.getUTCMonth()]}`;
}

/** Suma `days` días a una fecha. No muta el argumento original. */
export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Devuelve el lunes (00:00:00 hora Bolivia) de la semana que contiene
 * `date`. Usado en el dashboard de reservas para construir la grid
 * semanal — necesita estar anclado a Bolivia para que el lunes que ve
 * el owner coincida con el lunes calendárico boliviano, no UTC.
 */
export function startOfWeekMonday(date: Date): Date {
  const b = toBoliviaUTC(date);
  const day = b.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day;
  // Construimos el Date final que represente 00:00 BOT del lunes
  // calendárico — restamos `BOT_OFFSET_MS` para que el wall-clock
  // hora Bolivia sea 00:00.
  return new Date(
    Date.UTC(
      b.getUTCFullYear(),
      b.getUTCMonth(),
      b.getUTCDate() + diff,
      4, // +4h porque BOT = UTC-4 → 00:00 BOT = 04:00 UTC
      0,
      0,
      0,
    ),
  );
}

/** Inicio del día (00:00:00 HORA BOLIVIA). */
export function startOfDay(d: Date = new Date()): Date {
  const b = toBoliviaUTC(d);
  return new Date(
    Date.UTC(
      b.getUTCFullYear(),
      b.getUTCMonth(),
      b.getUTCDate(),
      4, // 00:00 BOT = 04:00 UTC
      0,
      0,
      0,
    ),
  );
}

/** True si ambas fechas son el mismo día calendario EN HORA BOLIVIA. */
export function sameDay(a: Date, b: Date): boolean {
  const ba = toBoliviaUTC(a);
  const bb = toBoliviaUTC(b);
  return (
    ba.getUTCFullYear() === bb.getUTCFullYear() &&
    ba.getUTCMonth() === bb.getUTCMonth() &&
    ba.getUTCDate() === bb.getUTCDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
