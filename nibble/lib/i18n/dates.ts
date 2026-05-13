/**
 * Helpers de fecha + i18n compartidos entre client y server.
 *
 * Antes vivían como copias literales en 4+ archivos (BookingForm,
 * BookingsWeek, reserva/page, analytics/page). Cualquier cambio
 * desincronizaba las copias en silencio.
 *
 * NO depende de `Intl.DateTimeFormat` con locale para evitar mismatches
 * de hydration entre Node y V8 (ICU implementations difieren).
 */

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

/** "YYYY-MM-DD" en la zona local del runtime. Determinista. */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "10 abr" — fecha corta sin día de semana. */
export function shortDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getDate()} ${MONTH_ES_SHORT[d.getMonth()] ?? ""}`;
}

/** "vie, 10 abr" — fecha corta con día de semana. */
export function shortDateWithWeekday(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${WEEKDAY_ES_SHORT[d.getDay()]?.toLowerCase() ?? ""}, ${d.getDate()} ${MONTH_ES_SHORT[d.getMonth()] ?? ""}`;
}

/** "lunes 12 de mayo" — fecha larga. */
export function longDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${WEEKDAY_ES_LOWER[d.getDay()]} ${d.getDate()} de ${MONTH_ES_SHORT[d.getMonth()]}`;
}

/** Suma `days` días a una fecha. No muta el argumento original. */
export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Devuelve el lunes (00:00:00) de la semana que contiene `date`. */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Inicio del día (00:00:00) en zona local. */
export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** True si ambas fechas son el mismo día calendario en zona local. */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
