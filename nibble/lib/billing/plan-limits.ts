import "server-only";
import { cache } from "react";
import { Role, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dateInBolivia, inBolivia } from "@/lib/booking/timezone";

// Prisma's transaction client type (`tx` callback arg). Aceptamos cualquiera
// de los dos para que callers que necesitan correr el check dentro de un
// advisory lock puedan pasar `tx` y la query ocurra en la misma conexión
// que tiene el lock. Sin esto el lock no protege nada (la query corre en
// el pool y otra request puede leer count stale).
export type TxClient = Prisma.TransactionClient | typeof db;

/**
 * Plan limits enforcement.
 *
 * Política por tipo de límite:
 *   - **Productos / staff**: HARD enforce. Las server actions que crean
 *     uno chequean el límite y devuelven error si el plan no permite más.
 *     El owner ve un mensaje claro y pueden subir de plan.
 *   - **Pedidos del mes**: SOFT — no bloqueamos el flujo del cliente
 *     final (sería terrible romper el checkout). En cambio reportamos el
 *     estado al admin via `checkOrderLimitThisMonth` para que vea
 *     overage real en la lista de tiendas / cobranzas.
 *
 * `limit === null` siempre significa "ilimitado".
 */

export type LimitStatus = {
  /** Cantidad actual usada. */
  current: number;
  /** Tope del plan. `null` = ilimitado. */
  limit: number | null;
  /** % de uso (0–100+). null si limit es null. */
  pct: number | null;
  /** True si current >= limit. False si limit=null (ilimitado). */
  exceeded: boolean;
  /** True si current >= 80% del limit. Útil para banners de advertencia. */
  nearLimit: boolean;
};

export function statusFrom(current: number, limit: number | null): LimitStatus {
  if (limit === null) {
    return { current, limit: null, pct: null, exceeded: false, nearLimit: false };
  }
  const pct = limit === 0 ? 100 : (current / limit) * 100;
  return {
    current,
    limit,
    pct,
    exceeded: current >= limit,
    nearLimit: pct >= 80,
  };
}

/**
 * Lee el `Plan` de la tienda. Memoizado per-request con `React.cache()`
 * para que los 3 checks (`checkProductLimit`, `checkStaffLimit`,
 * `checkOrderLimitThisMonth`) que se llaman juntos en el banner del
 * dashboard hagan UNA sola query, no tres.
 *
 * `React.cache` solo memoiza durante el lifecycle del request actual —
 * un request siguiente arranca limpio, sin riesgo de mostrar planes
 * stale tras un upgrade.
 */
type PlanLimits = {
  maxProducts: number | null;
  maxOrdersPerMonth: number | null;
  maxStaff: number | null;
} | null;

/**
 * Query cruda del plan sobre el `client` dado. DEBE usar el `client`, no el
 * singleton `db`: cuando `checkProductLimit`/`checkStaffLimit` corren DENTRO de
 * una transacción interactiva (advisory lock del CREATE), pegarle al pool con
 * `db` pide una segunda conexión — y con `connection_limit=1` la transacción ya
 * tiene la única, así que el query se cuelga hasta que la transacción expira a
 * los 5s ("Transaction already closed"). Ese fue el bug que impedía crear
 * productos. Ver `plan-limits.test.ts`.
 */
async function fetchPlanLimits(
  storeId: string,
  client: TxClient,
): Promise<PlanLimits> {
  const store = await client.store.findUnique({
    where: { id: storeId },
    select: {
      plan: {
        select: {
          maxProducts: true,
          maxOrdersPerMonth: true,
          maxStaff: true,
        },
      },
    },
  });
  return store?.plan ?? null;
}

/**
 * Lee el `Plan` de la tienda por el pool. Memoizado per-request con
 * `React.cache()` para que los 3 checks (`checkProductLimit`, `checkStaffLimit`,
 * `checkOrderLimitThisMonth`) que se llaman juntos en el banner del dashboard
 * hagan UNA sola query, no tres.
 *
 * SOLO para el camino por defecto (banner en Server Components). Adentro de una
 * transacción se usa `fetchPlanLimits(storeId, tx)` — ver nota arriba.
 */
const getStorePlanLimits = cache(
  (storeId: string): Promise<PlanLimits> => fetchPlanLimits(storeId, db),
);

/** Plan por el client correcto: el pool cacheado si es `db`, o el `tx` pasado. */
function planLimitsFor(storeId: string, client: TxClient): Promise<PlanLimits> {
  return client === db ? getStorePlanLimits(storeId) : fetchPlanLimits(storeId, client);
}

// ============== Checks individuales ==============

export async function checkProductLimit(
  storeId: string,
  client: TxClient = db,
): Promise<LimitStatus> {
  const plan = await planLimitsFor(storeId, client);
  const limit = plan?.maxProducts ?? null;
  const current = await client.product.count({
    where: { storeId, isActive: true },
  });
  return statusFrom(current, limit);
}

export async function checkStaffLimit(
  storeId: string,
  client: TxClient = db,
): Promise<LimitStatus> {
  const plan = await planLimitsFor(storeId, client);
  // `maxStaff` cuenta usuarios CASHIER (el owner no consume slot — el
  // plan starter tiene `maxStaff=1` que significa "1 cashier además del
  // owner"). Si el día de mañana el plan tiene maxStaff=0, el owner no
  // puede invitar a nadie y el feature de equipo queda escondido detrás
  // del upgrade.
  const limit = plan?.maxStaff ?? null;
  const current = await client.user.count({
    where: { storeId, role: Role.CASHIER, isActive: true },
  });
  return statusFrom(current, limit);
}

export async function checkOrderLimitThisMonth(
  storeId: string,
): Promise<LimitStatus> {
  const plan = await getStorePlanLimits(storeId);
  const limit = plan?.maxOrdersPerMonth ?? null;
  // "Mes actual" en hora Bolivia, no en hora del servidor. En Vercel
  // (UTC), el último día del mes Bolivia 23:00 BOT cae a las 03:00 UTC
  // del primer día del mes siguiente — con `setDate(1)` local UTC esos
  // pedidos cuentan en el mes equivocado, y el owner ve un contador
  // desfasado respecto a su percepción.
  const bot = inBolivia(new Date());
  const monthStart = dateInBolivia(bot.year, bot.month, 1, 0, 0, 0, 0);
  const current = await db.order.count({
    where: {
      storeId,
      createdAt: { gte: monthStart },
      status: {
        notIn: ["CANCELLED", "PENDING_PAYMENT"],
      },
    },
  });
  return statusFrom(current, limit);
}

// ============== Mensajes user-facing ==============

export function productLimitMessage(s: LimitStatus): string {
  if (!s.exceeded || s.limit === null) return "";
  return `Llegaste al tope de ${s.limit} productos activos del plan. Suspende alguno o pasa a un plan superior para agregar más.`;
}

export function staffLimitMessage(s: LimitStatus): string {
  if (!s.exceeded || s.limit === null) return "";
  return `Tu plan permite ${s.limit} ${s.limit === 1 ? "cajero" : "cajeros"}. Suspende alguno o sube de plan para invitar más.`;
}
