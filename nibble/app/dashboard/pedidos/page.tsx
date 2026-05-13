import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { formatBob } from "@/lib/utils";
import { STATUS_COLORS, PAYMENT_LABELS } from "@/lib/orders/status";
import { OrderStatusPill } from "@/components/ui/OrderStatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 50;

export const metadata = {
  title: "Pedidos · Madriguera Shop",
};

const FILTER_TABS: { key: "all" | "active" | "awaiting" | "delivered" | "cancelled"; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "awaiting", label: "Por verificar" },
  { key: "delivered", label: "Entregados" },
  { key: "cancelled", label: "Cancelados" },
  { key: "all", label: "Todos" },
];

function statusFilter(filter: string): { status?: { in: OrderStatus[] } } {
  switch (filter) {
    case "active":
      return { status: { in: ["NEW", "CONFIRMED", "PREPARING", "IN_DELIVERY"] } };
    case "delivered":
      return { status: { in: ["DELIVERED"] } };
    case "cancelled":
      return { status: { in: ["CANCELLED"] } };
    case "awaiting":
      return {}; // se filtra por paymentStatus aparte
    default:
      return {};
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  const { store } = await requireStoreOwner();
  const sp = await searchParams;
  const filter = sp.filter ?? "active";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  // Búsqueda: si q es numérico → match en orderNumber; si no → en customerName/Phone
  const qNum = /^\d+$/.test(q) ? Number(q) : null;
  const searchClause = q
    ? {
        OR: [
          ...(qNum !== null ? [{ orderNumber: qNum }] : []),
          { customerName: { contains: q, mode: "insensitive" as const } },
          { customerPhone: { contains: q } },
        ],
      }
    : {};

  const where = {
    storeId: store.id,
    ...statusFilter(filter),
    ...(filter === "awaiting" ? { paymentStatus: "AWAITING_VERIFICATION" as const } : {}),
    ...searchClause,
  };

  const [orders, total, activeCount, awaitingCount] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.count({
      where: {
        storeId: store.id,
        status: { in: ["NEW", "CONFIRMED", "PREPARING", "IN_DELIVERY"] },
      },
    }),
    db.order.count({
      where: { storeId: store.id, paymentStatus: "AWAITING_VERIFICATION" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filter !== "active") params.set("filter", filter);
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/dashboard/pedidos${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <DashboardHeader
        storeSlug={store.slug}
        notificationDot={awaitingCount > 0}
        leftSlot={
          <form action="/dashboard/pedidos" className="relative w-72 max-w-full">
            <input type="hidden" name="filter" value={filter} />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por #pedido, nombre o teléfono"
              className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
            />
          </form>
        }
      />

      <main className="p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Operación
            </p>
            <h1 className="font-display mt-1 text-3xl">Pedidos</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {activeCount} activos · {awaitingCount} con pago por verificar
            </p>
          </div>

          {/* Filter tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {FILTER_TABS.map((t) => {
              const isActive = filter === t.key;
              const badge =
                t.key === "active" ? activeCount : t.key === "awaiting" ? awaitingCount : null;
              return (
                <Link
                  key={t.key}
                  href={`/dashboard/pedidos?filter=${t.key}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition ${
                    isActive
                      ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                      : "border-[color:var(--line)] bg-[color:var(--card)] text-[color:var(--fg-soft)] hover:border-[color:var(--color-bark-300)]"
                  }`}
                >
                  {t.label}
                  {badge !== null && badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-semibold ${
                        isActive
                          ? "bg-white/15 text-white/90"
                          : "bg-[color:var(--bg)] text-[color:var(--muted)]"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* List */}
          <div className="mt-6">
            {orders.length === 0 ? (
              <EmptyState
                className="border-solid"
                icon={<ShoppingBag className="size-8" />}
                description="No hay pedidos para mostrar."
              />
            ) : (
              <ul className="space-y-2">
                {orders.map((order) => {
                  const colors = STATUS_COLORS[order.status];
                  const needsAttention =
                    order.paymentStatus === "AWAITING_VERIFICATION";
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/dashboard/pedidos/${order.id}`}
                        className="block rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 transition hover:border-[color:var(--color-bark-300)] hover:shadow-soft"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${colors.bg} ${colors.fg}`}>
                            <ShoppingBag className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold num-tabular">
                                #{order.orderNumber}
                              </span>
                              <span className="text-sm">{order.customerName}</span>
                              <OrderStatusPill status={order.status} />
                              {needsAttention && (
                                <span className="rounded-full bg-[color:var(--color-amber-100)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-amber-700)]">
                                  Verificar pago
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                              {order._count.items}{" "}
                              {order._count.items === 1 ? "ítem" : "ítems"} ·{" "}
                              {order.customerPhone} ·{" "}
                              {PAYMENT_LABELS[order.paymentStatus]}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold num-tabular">
                              {formatBob(Number(order.total))}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {order.createdAt.toLocaleString("es-BO", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="pedido"
            buildPageHref={buildPageHref}
          />
      </main>
    </>
  );
}
