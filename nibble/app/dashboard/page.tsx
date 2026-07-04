import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  Users,
  AlertTriangle,
  ChevronRight,
  Package,
} from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PlanLimitsBanner } from "@/components/dashboard/PlanLimitsBanner";
import { KpiCardCompact } from "@/components/shared/KpiCardCompact";
import {
  checkOrderLimitThisMonth,
  checkProductLimit,
  checkStaffLimit,
} from "@/lib/billing/plan-limits";
import { formatBob } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/orders/status";
import { OrderStatusPill } from "@/components/ui/OrderStatusPill";
import { startOfDay, addDays } from "@/lib/i18n/dates";
import { REAL_SALE_WHERE } from "@/lib/orders/revenue";

export const metadata = { title: "Inicio · Madriguera Shop" };

// `startOfDay` (TZ Bolivia) ya vive en `lib/i18n/dates`. Antes había una
// copia local con la misma lógica — riesgo de divergencia futura. La
// versión de `dates` ahora maneja TZ Bolivia internamente.
function startOfYesterday(now: Date): Date {
  return startOfDay(addDays(now, -1));
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export default async function DashboardHome() {
  const { store, user } = await requireStoreOwner();
  const isCashier = user.role === Role.CASHIER;

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfYesterday(now);

  // KPIs de hoy + ayer (para delta) + acciones pendientes
  const [
    todayOrders,
    yesterdayOrders,
    todayCustomers,
    yesterdayCustomers,
    awaitingPayments,
    lowStockProducts,
    pendingInvoices,
    recentOrders,
    topProducts,
  ] = await Promise.all([
    // "Ventas de hoy/ayer" usa el filtro canónico de venta real (ver
    // lib/orders/revenue.ts). Antes sumaba TODOS los pedidos — cancelados,
    // QR sin verificar y reembolsados inclusive — así que el KPI del home
    // sobrestimaba y no cuadraba con el de /dashboard/analytics.
    db.order.findMany({
      where: { storeId: store.id, createdAt: { gte: todayStart }, ...REAL_SALE_WHERE },
      select: { id: true, total: true },
    }),
    db.order.findMany({
      where: {
        storeId: store.id,
        createdAt: { gte: yesterdayStart, lt: todayStart },
        ...REAL_SALE_WHERE,
      },
      select: { id: true, total: true },
    }),
    db.customer.count({
      where: { storeId: store.id, createdAt: { gte: todayStart } },
    }),
    db.customer.count({
      where: {
        storeId: store.id,
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    db.order.count({
      where: { storeId: store.id, paymentStatus: "AWAITING_VERIFICATION" },
    }),
    // Comparar stock <= lowStockAlert por producto. Prisma no permite comparar
    // columnas directamente, así que usamos $queryRaw.
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Product"
      WHERE "storeId" = ${store.id}
        AND "manageStock" = true
        AND "isActive" = true
        AND "lowStockAlert" IS NOT NULL
        AND "stock" <= "lowStockAlert"
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    db.invoice.findMany({
      where: { storeId: store.id, status: { in: ["PENDING", "OVERDUE"] } },
      select: { id: true, amount: true, dueDate: true, invoiceNumber: true },
      orderBy: { dueDate: "asc" },
      take: 1,
    }),
    db.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        status: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true }, take: 3 },
      },
    }),
    db.orderItem.groupBy({
      by: ["productName"],
      where: {
        order: {
          storeId: store.id,
          createdAt: { gte: todayStart },
          ...REAL_SALE_WHERE,
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const todaySales = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const yesterdaySales = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);
  const todayCount = todayOrders.length;
  const yesterdayCount = yesterdayOrders.length;
  const todayAvg = todayCount > 0 ? todaySales / todayCount : 0;
  const yesterdayAvg = yesterdayCount > 0 ? yesterdaySales / yesterdayCount : 0;

  const ownerName =
    user.name?.split(" ")[0] ?? user.email ?? "vendedor";

  // Plan limits: chequeo en cada visita al home. Solo los OWNERS ven los
  // banners (un cashier no puede subir de plan, no aporta mostrárselos).
  // Las 3 queries son chicas (`count` con índices) — se computan en
  // paralelo con las del resto de la home si performance importa.
  const [productLimit, staffLimit, orderLimit] = isCashier
    ? [null, null, null]
    : await Promise.all([
        checkProductLimit(store.id),
        checkStaffLimit(store.id),
        checkOrderLimitThisMonth(store.id),
      ]);

  return (
    <>
      <DashboardHeader
        storeSlug={store.slug}
        initialAwaiting={awaitingPayments}
      />

      <main className="p-6 lg:p-8">
          {!isCashier && (productLimit || staffLimit || orderLimit) && (
            <PlanLimitsBanner
              products={productLimit}
              staff={staffLimit}
              orders={orderLimit}
            />
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Hola, {ownerName}
              </p>
              <h1 className="font-display mt-1 text-3xl">Tu tienda hoy</h1>
            </div>
            <p className="text-xs text-[color:var(--muted)]">
              {now.toLocaleDateString("es-BO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "America/La_Paz",
              })}
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <KpiCardCompact
              icon={ShoppingBag}
              label="Pedidos hoy"
              value={String(todayCount)}
              delta={pctChange(todayCount, yesterdayCount)}
            />
            <KpiCardCompact
              icon={Wallet}
              label="Ventas hoy"
              value={formatBob(todaySales)}
              delta={pctChange(todaySales, yesterdaySales)}
            />
            <KpiCardCompact
              icon={TrendingUp}
              label="Ticket promedio"
              value={formatBob(todayAvg)}
              delta={pctChange(Math.round(todayAvg), Math.round(yesterdayAvg))}
            />
            <KpiCardCompact
              icon={Users}
              label="Clientes nuevos"
              value={String(todayCustomers)}
              delta={pctChange(todayCustomers, yesterdayCustomers)}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* Recent orders */}
            <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Pedidos recientes</h2>
                <Link
                  href="/dashboard/pedidos"
                  className="inline-flex items-center text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                >
                  Ver todos <ChevronRight className="ml-0.5 size-3.5" />
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-[color:var(--bg)] p-8 text-center">
                  <ShoppingBag className="mx-auto size-6 text-[color:var(--muted)]" />
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Cuando entren pedidos, aparecen acá.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-[color:var(--line)]">
                  {recentOrders.map((o) => {
                    const c = STATUS_COLORS[o.status];
                    const itemsSummary = o.items
                      .map((i) => `${i.quantity}× ${i.productName}`)
                      .join(", ");
                    return (
                      <li key={o.id}>
                        <Link
                          href={`/dashboard/pedidos/${o.id}`}
                          className="flex items-center gap-3 py-3 transition hover:bg-[color:var(--bg)] -mx-2 px-2 rounded-lg"
                        >
                          <div
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.fg}`}
                          >
                            <ShoppingBag className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold num-tabular">
                                #{o.orderNumber}
                              </span>
                              <span className="text-sm">{o.customerName}</span>
                              <OrderStatusPill
                                status={o.status}
                                className="hidden md:inline"
                              />
                            </div>
                            <p className="truncate text-xs text-[color:var(--muted)]">
                              {itemsSummary}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold num-tabular">
                              {formatBob(Number(o.total))}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {o.createdAt.toLocaleTimeString("es-BO", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "America/La_Paz",
                              })}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-6">
              {/* Action items — facturas pendientes y stock bajo son cosas
                  del dueño; el cajero sólo ve los comprobantes para verificar. */}
              {(awaitingPayments > 0 ||
                (!isCashier && lowStockProducts > 0) ||
                (!isCashier && pendingInvoices.length > 0)) && (
                <div className="rounded-3xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-5">
                  <div className="flex items-center gap-2 text-[color:var(--color-amber-700)]">
                    <AlertTriangle className="size-4" />
                    <h3 className="text-sm font-semibold">
                      Necesitan tu atención
                    </h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {awaitingPayments > 0 && (
                      <li className="flex items-center justify-between">
                        <span>
                          {awaitingPayments} comprobante
                          {awaitingPayments === 1 ? "" : "s"} por verificar
                        </span>
                        <Link
                          href="/dashboard/pedidos?filter=awaiting"
                          className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline"
                        >
                          Revisar
                        </Link>
                      </li>
                    )}
                    {!isCashier && lowStockProducts > 0 && (
                      <li className="flex items-center justify-between">
                        <span>
                          {lowStockProducts} producto
                          {lowStockProducts === 1 ? "" : "s"} con stock bajo
                        </span>
                        <Link
                          href="/dashboard/productos"
                          className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline"
                        >
                          Ver lista
                        </Link>
                      </li>
                    )}
                    {!isCashier && pendingInvoices[0] && (
                      <li className="flex items-center justify-between">
                        <span>
                          Factura {pendingInvoices[0].invoiceNumber} —{" "}
                          {formatBob(Number(pendingInvoices[0].amount))}
                        </span>
                        <Link
                          href="/dashboard/facturacion"
                          className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline"
                        >
                          Pagar
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Top products today */}
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="font-semibold">Top productos hoy</h3>
                {topProducts.length === 0 ? (
                  <div className="mt-4 rounded-xl bg-[color:var(--bg)] p-4 text-center text-sm text-[color:var(--muted)]">
                    Sin ventas hoy. Cuando empiecen, los más pedidos aparecen acá.
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {topProducts.map((p, i) => (
                      <li
                        key={p.productName}
                        className="flex items-center gap-3"
                      >
                        <span className="w-5 text-center text-xs font-bold text-[color:var(--muted)]">
                          {i + 1}
                        </span>
                        <Package className="size-4 shrink-0 text-[color:var(--muted)]" />
                        <span className="flex-1 truncate text-sm">
                          {p.productName}
                        </span>
                        <span className="text-xs text-[color:var(--muted)] num-tabular">
                          {p._sum.quantity ?? 0} ventas
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
        </div>
      </main>
    </>
  );
}

