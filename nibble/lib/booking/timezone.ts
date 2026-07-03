/**
 * Timezone helpers para reservas (zona horaria fija Bolivia, BOT = UTC-4).
 *
 * Bolivia no observa horario de verano y mantiene UTC-4 todo el año,
 * así que podemos hardcodear el offset sin riesgo de DST shifts. Esto
 * es por diseño: queremos que el comportamiento sea idéntico en Vercel
 * (UTC), en un VPS local, o en una laptop con TZ del cliente — todos
 * tienen que producir el MISMO instante para "10:00 del 12 de mayo en
 * Bolivia".
 *
 * Sin estos helpers, `new Date(yyyy, m, d, hh, mm)` usa la TZ del
 * proceso, y los slots aparecían 4 h desfasados en producción.
 */

const BOT_OFFSET_HOURS = -4;

/**
 * Construye un `Date` que representa "esta hora-pared en Bolivia".
 *
 * Internamente usa `Date.UTC(...)` (que ignora la TZ del proceso) y
 * suma 4 h para que el wall-clock corresponda a hora Bolivia.
 *
 * @example
 *   dateInBolivia(2026, 4, 12, 9, 0)  // 09:00 BOT del 12-may-2026
 *   // → mismo Date que `new Date("2026-05-12T13:00:00Z")`
 */
export function dateInBolivia(
  year: number,
  monthIndex: number,
  day: number,
  hh = 0,
  mm = 0,
  ss = 0,
  ms = 0,
): Date {
  return new Date(
    Date.UTC(year, monthIndex, day, hh - BOT_OFFSET_HOURS, mm, ss, ms),
  );
}

/**
 * Parsea "YYYY-MM-DD" (output de un `<input type="date">`) asumiendo
 * que esa fecha-calendario representa el día completo en Bolivia.
 * Devuelve el `Date` correspondiente a 00:00 BOT.
 *
 * Retorna `null` si el string no parsea.
 */
export function parseBoliviaDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = parseInt(m[1]!, 10);
  const monthIndex = parseInt(m[2]!, 10) - 1;
  const day = parseInt(m[3]!, 10);
  const d = dateInBolivia(year, monthIndex, day, 0, 0, 0, 0);
  // Validar que JS no nos hizo "overflow" silencioso: `Date.UTC(2026, 12, 99)`
  // matchea la regex pero JS lo trata como mes=enero del año siguiente,
  // día=99 más allá. Sin esta verificación, `parseBoliviaDate("2026-13-99")`
  // retorna una fecha absurda en vez de `null`, y eso queda guardado.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== monthIndex ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/**
 * Parsea "YYYY-MM-DDTHH:MM" (output de un `<input type="datetime-local">`)
 * asumiendo que esa hora-pared corresponde a hora Bolivia. Devuelve el
 * `Date` correspondiente al instante real.
 *
 * Aceptamos también "YYYY-MM-DDTHH:MM:SS" por si algún cliente envía
 * segundos.
 *
 * Retorna `null` si el string no parsea.
 */
export function parseBoliviaDateTime(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const year = parseInt(m[1]!, 10);
  const monthIndex = parseInt(m[2]!, 10) - 1;
  const day = parseInt(m[3]!, 10);
  const hh = parseInt(m[4]!, 10);
  const mm = parseInt(m[5]!, 10);
  const ss = m[6] ? parseInt(m[6], 10) : 0;
  // Validar rangos antes de construir — `Date.UTC` acepta valores fuera
  // de rango y los "rolea", devolviendo timestamps absurdos para
  // entradas como "25:99" o "2026-13-99T...".
  if (
    monthIndex < 0 || monthIndex > 11 ||
    day < 1 || day > 31 ||
    hh < 0 || hh > 23 ||
    mm < 0 || mm > 59 ||
    ss < 0 || ss > 59
  ) {
    return null;
  }
  const d = dateInBolivia(year, monthIndex, day, hh, mm, ss, 0);
  // Doble-check para días "imposibles" en el mes (ej. 31 de febrero).
  const offsetted = new Date(d.getTime() + BOT_OFFSET_HOURS * 3600 * 1000);
  if (
    offsetted.getUTCFullYear() !== year ||
    offsetted.getUTCMonth() !== monthIndex ||
    offsetted.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/**
 * Inversa de `parseBoliviaDateTime`: convierte un instante (Date/ISO) a
 * "YYYY-MM-DDTHH:mm" en hora-pared BOLIVIA, el formato que espera un
 * `<input type="datetime-local">`. Determinística respecto a la TZ del
 * browser/proceso — imprescindible porque el server parsea ese mismo
 * string como hora Bolivia: si el form lo renderizara con la TZ del
 * browser, el round-trip editar→guardar correría la hora.
 *
 * Usada por los forms de vigencia (cupones, banners, popups).
 */
export function toBoliviaDatetimeLocal(input: Date | string): string {
  const b = inBolivia(typeof input === "string" ? new Date(input) : input);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${b.year}-${pad(b.month + 1)}-${pad(b.day)}T${pad(b.hours)}:${pad(b.minutes)}`;
}

/**
 * Devuelve los componentes wall-clock de un `Date` en hora Bolivia.
 * Útil para renderizado consistente sin importar la TZ del browser.
 *
 *   inBolivia(new Date("2026-05-12T13:00:00Z"))
 *   // → { year:2026, month:4, day:12, weekday:2, hours:9, minutes:0 }
 *
 * `month` es 0-indexed, `weekday` es 0=Dom..6=Sáb (igual que getUTCDay).
 */
export function inBolivia(d: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
} {
  // BOT = UTC - 4h. Sumamos BOT_OFFSET_HOURS (que es -4) al timestamp y
  // luego usamos `getUTC*` para extraer componentes sin que la TZ del
  // browser/server interfiera. Equivale a "shifteamos el timestamp 4h
  // hacia atrás y leemos en UTC = leemos en BOT".
  const ms = d.getTime() + BOT_OFFSET_HOURS * 3600 * 1000;
  const u = new Date(ms);
  return {
    year: u.getUTCFullYear(),
    month: u.getUTCMonth(),
    day: u.getUTCDate(),
    weekday: u.getUTCDay(),
    hours: u.getUTCHours(),
    minutes: u.getUTCMinutes(),
    seconds: u.getUTCSeconds(),
    milliseconds: u.getUTCMilliseconds(),
  };
}
