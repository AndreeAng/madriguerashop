import type { StoreHours } from "@prisma/client";
import { inBolivia } from "@/lib/booking/timezone";

/**
 * Helpers de disponibilidad temporal compartidos entre el adapter del
 * storefront (que decide qué mostrar al cliente) y los server actions de
 * cart/checkout (que deben rechazar si el cliente intenta comprar fuera de
 * horario manipulando la UI).
 *
 * El "now" se inyecta como argumento para tests determinísticos y para
 * que diferentes calls dentro de la misma request usen el mismo timestamp
 * (evita el caso "producto válido a las 22:59:59 pero rechazado al
 * decrementar stock a las 23:00:00").
 *
 * Todo se evalúa en hora Bolivia (BOT, UTC-4) vía `inBolivia()`. Antes se
 * usaba `Date.getDay()/getHours()` locales del proceso — en Vercel (UTC)
 * el día y la hora salían desfasados 4h, así que un cliente programando
 * "domingo 23:00 BOT" pasaba como "lunes 03:00 UTC" y el horario se
 * evaluaba contra el día equivocado.
 */

type ProductSchedule = {
  hasSchedule: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  availableDays: number[];
};

function toHHMM(hours: number, minutes: number): string {
  return (
    String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0")
  );
}

/**
 * True si el producto está dentro de su ventana horaria (o si no tiene
 * schedule activo).
 *
 * Reglas:
 *   - `hasSchedule=false` → siempre disponible
 *   - `hasSchedule=true` con TODO vacío → mal configurado → NO disponible
 *     (fuerza al owner a completar la config en lugar de tener un flag
 *     mudo que no hace nada)
 *   - Rango que cruza medianoche (22:00–03:00) → unión de [22:00, 24:00)
 *     ∪ [00:00, 03:00]
 */
export function isProductAvailableNow(
  product: ProductSchedule,
  now: Date = new Date(),
): boolean {
  if (!product.hasSchedule) return true;

  const hasDayFilter = product.availableDays.length > 0;
  const hasTimeFilter = !!(product.availableFrom && product.availableTo);
  if (!hasDayFilter && !hasTimeFilter) return false;

  const bot = inBolivia(now);

  if (hasDayFilter && !product.availableDays.includes(bot.weekday)) {
    return false;
  }

  if (hasTimeFilter) {
    const hhmm = toHHMM(bot.hours, bot.minutes);
    const from = product.availableFrom!;
    const to = product.availableTo!;
    if (to >= from) {
      if (hhmm < from || hhmm > to) return false;
    } else {
      if (hhmm < from && hhmm > to) return false;
    }
  }

  return true;
}

/**
 * True si la tienda está abierta ahora según `StoreHours`.
 *
 * `StoreHours` modela por día de semana (0=domingo … 6=sábado). Si no hay
 * row para hoy lo tratamos como cerrado — el seed debe sembrar las 7 filas.
 * Si `isClosed=true` el día está marcado como cerrado por el owner.
 *
 * El cierre cruzando medianoche (22:00–02:00) se soporta — pero StoreHours
 * actual NO modela el día siguiente del cierre. Si el cierre es <= apertura,
 * asumimos que cruza medianoche y validamos contra ese día.
 */
export function isStoreOpenNow(hours: StoreHours[], now: Date = new Date()): boolean {
  if (hours.length === 0) {
    // Si la tienda no configuró horarios, no podemos validar. Devolvemos
    // true para no bloquear pedidos en stores con seed incompleto — es
    // responsabilidad del owner configurar.
    return true;
  }
  const bot = inBolivia(now);
  const today = hours.find((h) => h.dayOfWeek === bot.weekday);
  if (!today || today.isClosed) return false;

  const hhmm = toHHMM(bot.hours, bot.minutes);
  const from = today.openTime;
  const to = today.closeTime;
  if (to >= from) {
    return hhmm >= from && hhmm <= to;
  }
  // Cruza medianoche
  return hhmm >= from || hhmm <= to;
}
