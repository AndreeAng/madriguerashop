import Link from "next/link";
import {
  Clock,
  Eye,
  MapPin,
  Package,
  PackageX,
  Repeat,
  ShoppingBag,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MapDensity } from "@/components/shared/MapsClient";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatBob, formatBobAmount } from "@/lib/utils";
import { dashboardCopy, type DashboardCopy } from "@/lib/dashboard/copy";
import { dateInBolivia, inBolivia } from "@/lib/booking/timezone";

export const metadata = { title: "Analytics · Madriguera Shop" };

// El h2 "Productos top" y demás varían por vertical, así que dejamos
// el title del tab del browser estático (no hay un sustantivo principal
// que decida la vista).

// Rangos soportados. Cada uno define la ventana actual + se compara con
// la ventana inmediatamente anterior del mismo tamaño para los deltas %.
const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
const DEFAULT_RANGE = "30d";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { store } = await requireStoreOwner();
  const copy = dashboardCopy(store.vertical);
  const noOrdersMsg = `Sin ${copy.ordersLabel.toLowerCase()} en este período.`;
  const sp = await searchParams;
  const rangeKey = sp.range && RANGE_DAYS[sp.range] ? sp.range : DEFAULT_RANGE;
  const days = RANGE_DAYS[rangeKey]!;

  const now = new Date();
  // Ventana anclada a 00:00 HORA BOLIVIA (no TZ del proceso). `setHours(0)`
  // en Vercel (UTC) trunca a 00:00 UTC = 20:00 BOT del día anterior, lo
  // que metía pedidos de la tarde anterior en la ventana y daba KPIs
  // desfasados 4h respecto a lo que el owner percibe en su día.
  const bot = inBolivia(now);
  const from = dateInBolivia(bot.year, bot.month, bot.day - days, 0, 0, 0, 0);
  const prevFrom = dateInBolivia(
    bot.year,
    bot.month,
    bot.day - days * 2,
    0,
    0,
    0,
    0,
  );

  // Estados que cuentan como "venta real". CANCELLED y PENDING_PAYMENT
  // quedan fuera — el primero porque no se cobró, el segundo porque aún
  // no se confirmó pago.
  const realSaleStatus = {
    notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT],
  };

  // Queries en paralelo para no bloquear el render. Cada bloque está
  // anotado con qué métrica produce — facilita auditar si una métrica se
  // ve "rara" (cuál query la calcula).
  const [
    // Ventana actual
    currentOrders,
    currentAggregate,
    currentNewCustomers,
    pageViewsCount,
    // Ventana anterior (para deltas)
    prevOrders,
    prevAggregate,
    prevNewCustomers,
    // Top productos por revenue
    topProductsRaw,
    // Top clientes por total gastado
    topCustomers,
    // Estados actuales (snapshot, no por ventana)
    statusBreakdown,
    // Datos para el chart diario
    dailyOrders,
    // Patrones temporales
    hourlyRows,
    weekdayRows,
    // Salud del negocio
    cancelledCount,
    totalInWindow,
    cancelReasonsRaw,
    customerOrderCounts,
    // Mapa de pedidos
    mapPointsRaw,
    // Inventario dormido
    deadProducts,
  ] = await Promise.all([
    db.order.count({
      where: { storeId: store.id, createdAt: { gte: from }, status: realSaleStatus },
    }),
    db.order.aggregate({
      where: { storeId: store.id, createdAt: { gte: from }, status: realSaleStatus },
      _sum: { total: true },
    }),
    db.customer.count({
      where: { storeId: store.id, createdAt: { gte: from } },
    }),
    db.pageView.count({
      where: { storeId: store.id, createdAt: { gte: from } },
    }),
    db.order.count({
      where: {
        storeId: store.id,
        createdAt: { gte: prevFrom, lt: from },
        status: realSaleStatus,
      },
    }),
    db.order.aggregate({
      where: {
        storeId: store.id,
        createdAt: { gte: prevFrom, lt: from },
        status: realSaleStatus,
      },
      _sum: { total: true },
    }),
    db.customer.count({
      where: {
        storeId: store.id,
        createdAt: { gte: prevFrom, lt: from },
      },
    }),
    // Top 5 productos por suma de OrderItem.subtotal en la ventana actual.
    // Filtramos por status del pedido en el JOIN — Prisma groupBy no
    // soporta join filtering directo, así que usamos `where` con relation.
    db.orderItem.groupBy({
      by: ["productId", "productName"],
      where: {
        order: {
          storeId: store.id,
          createdAt: { gte: from },
          status: realSaleStatus,
        },
      },
      _sum: { subtotal: true, quantity: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 5,
    }),
    db.customer.findMany({
      where: { storeId: store.id, ordersCount: { gt: 0 } },
      orderBy: { totalSpent: "desc" },
      take: 5,
      select: {
        id: true,
        fullName: true,
        phone: true,
        ordersCount: true,
        totalSpent: true,
        lastOrderAt: true,
      },
    }),
    // Breakdown actual (snapshot, no por ventana — refleja pedidos activos
    // en pipeline ahora mismo).
    db.order.groupBy({
      by: ["status"],
      where: { storeId: store.id },
      _count: { _all: true },
    }),
    // Pedidos por día (ventana actual): para chart. Lo agrupamos en SQL
    // con `date_trunc` para no traer todos los orders al app.
    //
    // `AT TIME ZONE 'America/La_Paz'` convierte `createdAt` (timestamptz
    // UTC) a hora-pared Bolivia antes del truncado. Sin esto, `date_trunc`
    // corta en 00:00 UTC = 20:00 BOT del día anterior — los pedidos
    // tomados entre 20:00 y 23:59 BOT aparecen en el día equivocado.
    db.$queryRaw<{ day: Date; count: bigint; revenue: string | null }[]>`
      SELECT
        date_trunc('day', "createdAt" AT TIME ZONE 'America/La_Paz') AS day,
        COUNT(*)::bigint AS count,
        SUM(CASE WHEN "status" NOT IN ('CANCELLED', 'PENDING_PAYMENT') THEN "total" ELSE 0 END)::text AS revenue
      FROM "Order"
      WHERE "storeId" = ${store.id} AND "createdAt" >= ${from}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    // Hora pico: pedidos agrupados por hora del día (0-23) en HORA BOLIVIA.
    // El servidor corre en UTC, así que sin el `AT TIME ZONE` la hora pico
    // aparece 4 horas adelantada y el owner ve "pico 23:00" cuando su
    // realidad es 19:00 BOT.
    db.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT
        EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/La_Paz')::int AS hour,
        COUNT(*)::bigint AS count
      FROM "Order"
      WHERE "storeId" = ${store.id}
        AND "createdAt" >= ${from}
        AND "status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    // Día de la semana: 0=domingo … 6=sábado (convención Postgres DOW),
    // en HORA BOLIVIA — un pedido del sábado 22:00 BOT cae a las 02:00 UTC
    // del domingo. Sin el shift de TZ, ese pedido se contaría como del
    // domingo y desfasaría el reporte de día más fuerte.
    db.$queryRaw<{ dow: number; count: bigint; revenue: string | null }[]>`
      SELECT
        EXTRACT(DOW FROM "createdAt" AT TIME ZONE 'America/La_Paz')::int AS dow,
        COUNT(*)::bigint AS count,
        SUM("total")::text AS revenue
      FROM "Order"
      WHERE "storeId" = ${store.id}
        AND "createdAt" >= ${from}
        AND "status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    // Cancelaciones en la ventana + total para calcular tasa. Trae también
    // los motivos top — agrupados directamente por la string del cancelReason
    // (sin normalizar; aceptamos algo de ruido por ahora).
    db.order.count({
      where: {
        storeId: store.id,
        createdAt: { gte: from },
        status: OrderStatus.CANCELLED,
      },
    }),
    db.order.count({
      where: { storeId: store.id, createdAt: { gte: from } },
    }),
    db.order.groupBy({
      by: ["cancelReason"],
      where: {
        storeId: store.id,
        createdAt: { gte: from },
        status: OrderStatus.CANCELLED,
        cancelReason: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { cancelReason: "desc" } },
      take: 3,
    }),
    // Repeat rate: distinct customers en la ventana + cuántos pidieron 2+
    // veces. Devolvemos el conteo agregado por customer, después
    // post-procesamos en JS (menos código que un sub-query).
    db.order.groupBy({
      by: ["customerId"],
      where: {
        storeId: store.id,
        createdAt: { gte: from },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT] },
        customerId: { not: null },
      },
      _count: { _all: true },
    }),
    // Puntos para el mapa de pedidos: solo coordenadas no-null en la
    // ventana. `select` específico para no traer datos personales del
    // cliente — el merchant ya ve el detalle del cliente en cada pedido.
    db.order.findMany({
      where: {
        storeId: store.id,
        createdAt: { gte: from },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT] },
        deliveryLat: { not: null },
        deliveryLng: { not: null },
      },
      select: { deliveryLat: true, deliveryLng: true },
      // Limitamos a un nº razonable: cargar 5000 puntos en un mapa
      // browser-side empieza a costar. Si la tienda los tiene, el muestreo
      // ya cuenta la historia (densidad por barrio).
      take: 2000,
    }),
    // Inventario dormido: productos activos sin ventas (no canceladas) en
    // la ventana. NOT EXISTS es más eficiente que `NOT IN` con subquery
    // porque Postgres lo evalúa con anti-join.
    db.$queryRaw<{ id: string; name: string; stock: number; basePrice: string }[]>`
      SELECT p.id, p.name, p.stock, p."basePrice"::text AS "basePrice"
      FROM "Product" p
      WHERE p."storeId" = ${store.id}
        AND p."isActive" = true
        AND NOT EXISTS (
          SELECT 1 FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."productId" = p.id
            AND o."storeId" = ${store.id}
            AND o."createdAt" >= ${from}
            AND o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
        )
      ORDER BY p."createdAt" ASC
      LIMIT 10
    `,
  ]);

  // Series del chart: rellenamos días sin pedidos con count=0 para no
  // saltar barras en el eje X.
  const series = fillDailySeries(dailyOrders, from, now);

  const currentRevenue = Number(currentAggregate._sum.total ?? 0);
  const prevRevenue = Number(prevAggregate._sum.total ?? 0);
  const currentAOV = currentOrders > 0 ? currentRevenue / currentOrders : 0;
  const prevAOV = prevOrders > 0 ? prevRevenue / prevOrders : 0;
  const conversion = pageViewsCount > 0 ? (currentOrders / pageViewsCount) * 100 : 0;

  const statusMap = new Map(
    statusBreakdown.map((s) => [s.status, s._count._all]),
  );
  const pendingPayment = statusMap.get(OrderStatus.PENDING_PAYMENT) ?? 0;
  const newOrders = statusMap.get(OrderStatus.NEW) ?? 0;
  const preparing = statusMap.get(OrderStatus.PREPARING) ?? 0;
  const inDelivery = statusMap.get(OrderStatus.IN_DELIVERY) ?? 0;

  // Patrones temporales: rellenamos las 24 horas y los 7 días para que
  // los charts muestren slots vacíos como barras chatas (más legible
  // que saltar números).
  const hourly = fillBuckets(
    hourlyRows.map((r) => ({ key: r.hour, count: Number(r.count) })),
    24,
  );
  const weekday = fillBuckets(
    weekdayRows.map((r) => ({ key: r.dow, count: Number(r.count) })),
    7,
  );

  // Tasa de cancelación + motivos top.
  const cancelRate =
    totalInWindow > 0 ? (cancelledCount / totalInWindow) * 100 : 0;
  const cancelReasons = cancelReasonsRaw
    .filter((r) => r.cancelReason)
    .map((r) => ({
      reason: r.cancelReason as string,
      count: r._count._all,
    }));

  // Repeat rate: clientes con 2+ pedidos en la ventana sobre el total de
  // clientes activos. Métrica de salud — "qué % de mi base vuelve".
  const totalCustomersInWindow = customerOrderCounts.length;
  const repeatCustomers = customerOrderCounts.filter(
    (c) => c._count._all >= 2,
  ).length;
  const repeatRate =
    totalCustomersInWindow > 0
      ? (repeatCustomers / totalCustomersInWindow) * 100
      : 0;

  // Puntos del mapa: Prisma trae Float | null; el filtro ya excluye los
  // null, pero TS aún ve los tipos como nullable. Lo aseguramos.
  const mapPoints = mapPointsRaw
    .filter(
      (p): p is { deliveryLat: number; deliveryLng: number } =>
        p.deliveryLat != null && p.deliveryLng != null,
    )
    .map((p) => ({ lat: p.deliveryLat, lng: p.deliveryLng }));

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="mx-auto max-w-6xl p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Tu tienda en números
            </p>
            <h1 className="font-display mt-1 text-3xl">Analytics</h1>
          </div>

          <RangeTabs current={rangeKey} />
        </div>

        {/* KPIs principales — `pctDelta` devuelve integer-percent (ya × 100)
            y null cuando no hay período comparable. `showNoComparable` muestra
            badge "sin comparable" en vez de dejar hueco. */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Wallet className="size-4" />}
            label="Ingresos"
            value={formatBob(currentRevenue)}
            delta={pctDelta(currentRevenue, prevRevenue)}
            deltaFormat="percent"
            showNoComparable
          />
          <KpiCard
            icon={<ShoppingBag className="size-4" />}
            label={copy.ordersLabel}
            value={currentOrders.toLocaleString("es-BO")}
            delta={pctDelta(currentOrders, prevOrders)}
            deltaFormat="percent"
            showNoComparable
          />
          <KpiCard
            icon={<Package className="size-4" />}
            label="Ticket promedio"
            value={formatBob(currentAOV)}
            delta={pctDelta(currentAOV, prevAOV)}
            deltaFormat="percent"
            showNoComparable
            hint={currentOrders === 0 ? `Sin ${copy.ordersLabel.toLowerCase()} en el período` : undefined}
          />
          <KpiCard
            icon={<Users className="size-4" />}
            label="Clientes nuevos"
            value={currentNewCustomers.toLocaleString("es-BO")}
            delta={pctDelta(currentNewCustomers, prevNewCustomers)}
            deltaFormat="percent"
            showNoComparable
          />
        </section>

        {/* Secundarios: tráfico + conversión + pipeline */}
        <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MiniCard
            icon={<Eye className="size-4" />}
            label="Visitas al storefront"
            value={pageViewsCount.toLocaleString("es-BO")}
            sub={`Conversión: ${conversion.toFixed(1)}%`}
          />
          <MiniCard
            icon={<ShoppingBag className="size-4" />}
            label="Pedidos en cocina"
            value={String(newOrders + preparing + inDelivery)}
            sub={`${newOrders} nuevos · ${preparing} preparando · ${inDelivery} en ruta`}
          />
          <MiniCard
            icon={<Wallet className="size-4" />}
            label="Esperando pago"
            value={String(pendingPayment)}
            sub={
              pendingPayment > 0
                ? "Revisa los comprobantes pendientes"
                : "Todo verificado"
            }
            highlight={pendingPayment > 0}
          />
        </section>

        {/* Pulso del negocio: repeat + cancelación */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <PulseCard
            icon={<Repeat className="size-4" />}
            label="Clientes que vuelven"
            value={`${repeatRate.toFixed(1)}%`}
            sub={
              totalCustomersInWindow === 0
                ? "Sin clientes activos en este período."
                : `${repeatCustomers} de ${totalCustomersInWindow} clientes pidió 2 o más veces.`
            }
            interpretation={
              totalCustomersInWindow === 0
                ? null
                : repeatRate >= 30
                  ? { tone: "good", text: "Base leal saludable. Sigue cuidándolos." }
                  : repeatRate >= 15
                    ? { tone: "neutral", text: "Mejorable — piensa en cupones de regreso." }
                    : { tone: "warn", text: "Pocos vuelven. Revisa calidad/tiempo de entrega." }
            }
          />
          <PulseCard
            icon={<XCircle className="size-4" />}
            label="Tasa de cancelación"
            value={`${cancelRate.toFixed(1)}%`}
            sub={
              totalInWindow === 0
                ? noOrdersMsg
                : `${cancelledCount} ${copy.ordersLabel.toLowerCase()} cancelados de ${totalInWindow} totales.`
            }
            extras={
              cancelReasons.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-[color:var(--fg-soft)]">
                  {cancelReasons.map((r) => (
                    <li
                      key={r.reason}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="truncate">{r.reason}</span>
                      <span className="num-tabular text-[color:var(--muted)]">
                        {r.count}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null
            }
            interpretation={
              totalInWindow === 0
                ? null
                : cancelRate <= 5
                  ? { tone: "good", text: "Bajo. Operación bajo control." }
                  : cancelRate <= 15
                    ? { tone: "neutral", text: "Aceptable, pero hay margen para bajar." }
                    : { tone: "warn", text: "Alto. Mira los motivos abajo y ataca la causa raíz." }
            }
          />
        </section>

        {/* Chart: pedidos por día */}
        <section className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Pedidos por día</h2>
            <p className="text-xs text-[color:var(--muted)]">
              Últimos {days} días
            </p>
          </div>
          <div className="mt-4">
            <DailyOrdersChart series={series} copy={copy} />
          </div>
        </section>

        {/* Patrones temporales: hora del día + día de la semana */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[color:var(--color-amber-600)]" />
              <h2 className="font-display text-lg">Hora pico</h2>
            </div>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              ¿A qué hora del día te piden más? Útil para ajustar el equipo
              en cocina/entrega.
            </p>
            <div className="mt-4">
              <HourlyChart buckets={hourly} copy={copy} />
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[color:var(--color-amber-600)]" />
              <h2 className="font-display text-lg">Día más fuerte</h2>
            </div>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Pedidos por día de la semana. Si el lunes está siempre vacío,
              ¿valdría una promo para activarlo?
            </p>
            <div className="mt-4">
              <WeekdayChart buckets={weekday} copy={copy} />
            </div>
          </div>
        </section>

        {/* Top productos + Top clientes */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-display text-lg">{copy.productsLabel} top</h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Por ingresos en los últimos {days} días.
            </p>
            {topProductsRaw.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                Todavía no hay {copy.ordersLabel.toLowerCase()} en este período.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--line)]">
                {topProductsRaw.map((p, i) => (
                  <li
                    key={p.productId}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--bg)] text-xs font-bold num-tabular">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.productName}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {Number(p._sum.quantity ?? 0)} unidades
                      </p>
                    </div>
                    <span className="num-tabular text-sm font-semibold">
                      {formatBob(Number(p._sum.subtotal ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-display text-lg">Clientes top</h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Histórico — los que más han gastado en tu tienda.
            </p>
            {topCustomers.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                Todavía no hay clientes con compras registradas.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--line)]">
                {topCustomers.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--bg)] text-xs font-bold num-tabular">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.fullName ?? "(sin nombre)"}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {c.phone} · {c.ordersCount} {c.ordersCount === 1 ? copy.orderSingular : copy.ordersLabel.toLowerCase()}
                      </p>
                    </div>
                    <span className="num-tabular text-sm font-semibold">
                      {formatBob(Number(c.totalSpent))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Mapa de densidad de pedidos */}
        <section className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[color:var(--color-tomato-600)]" />
              <h2 className="font-display text-lg">Mapa de {copy.ordersLabel.toLowerCase()}</h2>
            </div>
            <p className="text-xs text-[color:var(--muted)]">
              {mapPoints.length} {mapPoints.length === 1 ? copy.orderSingular : copy.ordersLabel.toLowerCase()} con ubicación en los últimos {days} días
            </p>
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Cada punto se hace más grande y más opaco cuanto más {copy.ordersLabel.toLowerCase()} llegaron
            ahí. Útil para identificar zonas con más demanda y planificar reparto.
          </p>
          <div className="mt-4">
            <MapDensity points={mapPoints} />
          </div>
        </section>

        {/* Inventario dormido */}
        <section className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
          <div className="flex items-center gap-2">
            <PackageX className="size-4 text-[color:var(--color-tomato-600)]" />
            <h2 className="font-display text-lg">Inventario dormido</h2>
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {copy.productsLabel} activos sin una sola venta en los últimos {days} días.
            Si están publicados pero nadie los compra, vale la pena revisar
            precio, foto, descripción — o sacarlos del catálogo.
          </p>
          {deadProducts.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--color-leaf-600)]">
              Todos tus {copy.productsLabel.toLowerCase()} activos tuvieron al menos una venta.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[color:var(--line)]">
              {deadProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-3"
                >
                  <Package className="size-4 shrink-0 text-[color:var(--muted)]" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/productos/${p.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-[color:var(--muted)]">
                      Stock: {p.stock} · Precio base: {formatBob(Number(p.basePrice))}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/productos/${p.id}`}
                    className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-[11px] hover:border-[color:var(--color-bark-300)]"
                  >
                    Revisar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

// ============== Helpers ==============

/** Δ % entre dos valores. Maneja edge cases (prev=0). */
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null; // null = "sin comparación posible"
  }
  return ((current - previous) / previous) * 100;
}

// Nombres hardcoded de día/mes para formateo DETERMINISTA. `toLocaleDateString`
// con "es-BO" produce strings ligeramente distintos entre Node (server) y
// V8 del browser (caps, separadores, no-break-space), causando hydration
// mismatch en React. Sin librerías ni globalización runtime evitamos
// ese problema entero.
const WEEKDAY_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH_ES = [
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

/** "10 abr" — sin día de semana. */
function shortDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getDate()} ${MONTH_ES[d.getMonth()] ?? ""}`;
}

/** "vie, 10 abr" — con día de semana. Usado en tooltips del chart. */
function shortDateWithWeekday(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${WEEKDAY_ES[d.getDay()] ?? ""}, ${d.getDate()} ${MONTH_ES[d.getMonth()] ?? ""}`;
}

/** Rellena buckets de tamaño fijo (24h / 7 días). Postgres devuelve solo
 *  los slots con datos; el chart necesita el array completo en orden para
 *  no saltar barras. */
function fillBuckets(
  rows: { key: number; count: number }[],
  size: number,
): { key: number; count: number }[] {
  const byKey = new Map(rows.map((r) => [r.key, r.count]));
  return Array.from({ length: size }, (_, i) => ({
    key: i,
    count: byKey.get(i) ?? 0,
  }));
}

/** Rellena días sin pedidos con count=0 para que el chart no salte. */
function fillDailySeries(
  rows: { day: Date; count: bigint; revenue: string | null }[],
  from: Date,
  to: Date,
): { day: string; count: number; revenue: number }[] {
  const byDay = new Map<string, { count: number; revenue: number }>();
  for (const r of rows) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    byDay.set(key, {
      count: Number(r.count),
      revenue: Number(r.revenue ?? 0),
    });
  }
  const out: { day: string; count: number; revenue: number }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({
      day: key,
      count: byDay.get(key)?.count ?? 0,
      revenue: byDay.get(key)?.revenue ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// ============== Subcomponentes UI ==============

function RangeTabs({ current }: { current: string }) {
  return (
    <div className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--card)] p-1">
      {(["7d", "30d", "90d"] as const).map((r) => {
        const active = current === r;
        return (
          <Link
            key={r}
            href={`/dashboard/analytics?range=${r}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-[color:var(--color-bark-900)] text-white"
                : "text-[color:var(--fg-soft)] hover:text-[color:var(--fg)]"
            }`}
          >
            {r === "7d" ? "7 días" : r === "30d" ? "30 días" : "90 días"}
          </Link>
        );
      })}
    </div>
  );
}

function MiniCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)]"
          : "border-[color:var(--line)] bg-[color:var(--card)]"
      }`}
    >
      <div className="flex items-center gap-2 text-[color:var(--fg-soft)]">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {label}
        </p>
      </div>
      <p className="mt-2 num-tabular text-xl font-semibold">{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{sub}</p>
      )}
    </div>
  );
}

/**
 * Tarjeta de "pulso del negocio" con valor grande + sub-texto + opcional
 * interpretación coloreada (good/neutral/warn). La idea es que el dueño
 * lea el número Y la interpretación sin pensar — un 5% de cancelación
 * solo dice "5%"; agregando "bajo, control" le decimos qué hacer (o no).
 */
function PulseCard({
  icon,
  label,
  value,
  sub,
  extras,
  interpretation,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  extras?: React.ReactNode;
  interpretation: { tone: "good" | "neutral" | "warn"; text: string } | null;
}) {
  const toneClasses =
    interpretation?.tone === "good"
      ? "bg-emerald-50 text-emerald-700"
      : interpretation?.tone === "warn"
        ? "bg-rose-50 text-rose-700"
        : "bg-[color:var(--bg)] text-[color:var(--fg-soft)]";

  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex items-center gap-2 text-[color:var(--fg-soft)]">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-4xl num-tabular leading-none">
        {value}
      </p>
      <p className="mt-2 text-sm text-[color:var(--fg-soft)]">{sub}</p>
      {extras}
      {interpretation && (
        <p className={`mt-4 rounded-xl px-3 py-2 text-xs ${toneClasses}`}>
          {interpretation.text}
        </p>
      )}
    </div>
  );
}

/**
 * Bar chart 24 horas. Hora pico se resalta visualmente para que el
 * dueño la identifique de un vistazo — "ah, mi pico es 19h, ponte
 * más gente desde las 18:30".
 */
function HourlyChart({
  buckets,
  copy,
}: {
  buckets: { key: number; count: number }[];
  copy: DashboardCopy;
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-[color:var(--muted)]">
        Sin {copy.ordersLabel.toLowerCase()} en este período.
      </p>
    );
  }
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const peakIdx = buckets.findIndex((b) => b.count === max);
  const width = 480;
  const height = 140;
  const padX = 8;
  const padY = 14;
  const barW = (width - padX * 2) / buckets.length;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        className="block min-w-[420px] max-w-full"
        role="img"
        aria-label={`${copy.ordersLabel} por hora del día`}
      >
        {buckets.map((b, i) => {
          const x = padX + barW * i + 1;
          const h = (b.count / max) * (height - padY * 2);
          const y = padY + (height - padY * 2 - h);
          const isPeak = i === peakIdx && b.count > 0;
          return (
            <rect
              key={b.key}
              x={x}
              y={y}
              width={Math.max(2, barW - 2)}
              height={h}
              rx={2}
              fill={isPeak ? "var(--color-tomato-500)" : "var(--color-amber-500)"}
              opacity={b.count > 0 ? 1 : 0.15}
            >
              <title>
                {String(b.key).padStart(2, "0")}:00 — {b.count} {copy.ordersLabel.toLowerCase()}
              </title>
            </rect>
          );
        })}
        {/* Ticks: 00, 06, 12, 18 */}
        {[0, 6, 12, 18].map((h) => {
          const x = padX + barW * h + barW / 2;
          return (
            <text
              key={h}
              x={x}
              y={height + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted)"
            >
              {String(h).padStart(2, "0")}h
            </text>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-[color:var(--muted)]">
        Hora pico:{" "}
        <strong className="text-[color:var(--color-tomato-600)]">
          {String(peakIdx).padStart(2, "0")}:00–{String((peakIdx + 1) % 24).padStart(2, "0")}:00
        </strong>{" "}
        con {buckets[peakIdx]?.count ?? 0} {copy.ordersLabel.toLowerCase()}.
      </p>
    </div>
  );
}

/**
 * Bar chart por día de la semana. Postgres devuelve 0=Domingo, lo
 * reordenamos a Lun–Dom para coincidir con la convención boliviana.
 * Día más fuerte se pinta distinto.
 */
function WeekdayChart({
  buckets,
  copy,
}: {
  buckets: { key: number; count: number }[];
  copy: DashboardCopy;
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-[color:var(--muted)]">
        Sin {copy.ordersLabel.toLowerCase()} en este período.
      </p>
    );
  }
  // Reordenar Dom(0)→Sáb(6) a Lun(1)→Sáb(6)→Dom(0) para lectura natural.
  const reordered = [1, 2, 3, 4, 5, 6, 0]
    .map((dow) => buckets.find((b) => b.key === dow))
    .filter((b): b is { key: number; count: number } => Boolean(b));
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const max = Math.max(1, ...reordered.map((b) => b.count));
  const peakIdx = reordered.findIndex((b) => b.count === max);

  const width = 360;
  const height = 140;
  const padX = 12;
  const padY = 14;
  const barW = (width - padX * 2) / reordered.length;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        className="block w-full"
        role="img"
        aria-label={`${copy.ordersLabel} por día de la semana`}
      >
        {reordered.map((b, i) => {
          const x = padX + barW * i + 4;
          const h = (b.count / max) * (height - padY * 2);
          const y = padY + (height - padY * 2 - h);
          const isPeak = i === peakIdx && b.count > 0;
          return (
            <g key={b.key}>
              <rect
                x={x}
                y={y}
                width={barW - 8}
                height={h}
                rx={3}
                fill={isPeak ? "var(--color-leaf-500)" : "var(--color-amber-500)"}
                opacity={b.count > 0 ? 1 : 0.15}
              >
                <title>{labels[i]}: {b.count} {copy.ordersLabel.toLowerCase()}</title>
              </rect>
              <text
                x={x + (barW - 8) / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-[color:var(--muted)]">
        Día más fuerte:{" "}
        <strong className="text-[color:var(--color-leaf-600)]">
          {labels[peakIdx]}
        </strong>{" "}
        con {reordered[peakIdx]?.count ?? 0} {copy.ordersLabel.toLowerCase()}.
      </p>
    </div>
  );
}

/**
 * Mini line+bar chart en SVG puro. Sin librerías externas (no vale meter
 * recharts/chart.js para 1 chart): mantenemos bundle chico y el look
 * coincide con el resto de la app. El eje Y es implícito (sólo tooltip).
 */
function DailyOrdersChart({
  series,
  copy,
}: {
  series: { day: string; count: number; revenue: number }[];
  copy: DashboardCopy;
}) {
  if (series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[color:var(--muted)]">
        Sin datos en el período.
      </p>
    );
  }
  const maxCount = Math.max(1, ...series.map((s) => s.count));
  const width = 720;
  const height = 160;
  const padX = 8;
  const padY = 14;
  const barW = (width - padX * 2) / series.length;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 26}`}
        className="block min-w-[640px] max-w-full"
        role="img"
        aria-label={`${copy.ordersLabel} por día`}
      >
        {/* Líneas guía horizontales: 0%, 50%, 100% del max */}
        {[0, 0.5, 1].map((p) => {
          const y = padY + (height - padY * 2) * (1 - p);
          return (
            <line
              key={p}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray={p === 0 ? "" : "2 2"}
            />
          );
        })}

        {/* Barras */}
        {series.map((s, i) => {
          const x = padX + barW * i + 1;
          const h = (s.count / maxCount) * (height - padY * 2);
          const y = padY + (height - padY * 2 - h);
          return (
            <g key={s.day}>
              <rect
                x={x}
                y={y}
                width={Math.max(2, barW - 2)}
                height={h}
                rx={2}
                fill="var(--color-amber-500)"
                opacity={s.count > 0 ? 1 : 0.15}
              >
                <title>
                  {shortDateWithWeekday(s.day)}: {s.count} {copy.ordersLabel.toLowerCase()} · Bs {formatBobAmount(s.revenue)}
                </title>
              </rect>
            </g>
          );
        })}

        {/* Etiquetas X: primera, mitad, última */}
        {[0, Math.floor(series.length / 2), series.length - 1]
          .filter((idx, i, arr) => arr.indexOf(idx) === i)
          .map((idx) => {
            const s = series[idx];
            if (!s) return null;
            const x = padX + barW * idx + barW / 2;
            return (
              <text
                key={idx}
                x={x}
                y={height + 18}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {shortDate(s.day)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
