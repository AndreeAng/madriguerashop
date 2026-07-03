import Link from "next/link";
import {
  TrendingUp,
  Store as StoreIcon,
  Users,
  Wallet,
  ArrowUpRight,
  Search,
  AlertTriangle,
  ShoppingBag,
  ExternalLink,
  FileText,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { REAL_SALE_WHERE } from "@/lib/orders/revenue";
import { formatBob } from "@/lib/utils";
import { KpiCardCompact } from "@/components/shared/KpiCardCompact";

export const metadata = { title: "Inicio · Admin" };

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const [
    storeCount,
    activeStoreCount,
    pastDueCount,
    suspendedCount,
    awaitingInvoicesCount,
    awaitingProofInvoicesCount,
    invoicePaidThisMonth,
    invoicePendingTotal,
    gmvThisMonth,
    recentStores,
    topStoresByGmv,
  ] = await Promise.all([
    db.store.count(),
    db.store.count({ where: { status: "ACTIVE" } }),
    db.store.count({ where: { status: "PAST_DUE" } }),
    db.store.count({ where: { status: "SUSPENDED" } }),
    db.invoice.count({ where: { status: { in: ["PENDING", "OVERDUE"] } } }),
    db.invoice.count({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        paidProofUrl: { not: null },
      },
    }),
    db.invoice.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.invoice.aggregate({
      where: { status: { in: ["PENDING", "OVERDUE"] } },
      _sum: { amount: true },
    }),
    // GMV con el filtro canónico de venta real (lib/orders/revenue.ts).
    // Antes solo excluía CANCELLED: los QR sin verificar (PENDING_PAYMENT,
    // potencialmente comprobantes falsos) y los reembolsados inflaban el GMV.
    db.order.aggregate({
      where: { createdAt: { gte: monthStart }, ...REAL_SALE_WHERE },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.store.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        name: true,
        vertical: true,
        status: true,
        city: true,
        createdAt: true,
        plan: { select: { name: true } },
      },
    }),
    // Top 5 stores por GMV resuelto en una query con JOIN raw — antes era
    // `groupBy` + segundo `findMany` para resolver nombres (2 RTTs).
    db.$queryRaw<
      { storeId: string; slug: string; name: string; gmv: number }[]
    >`
      SELECT o."storeId", s."slug", s."name",
             COALESCE(SUM(o."total"), 0)::float AS gmv
      FROM "Order" o
      JOIN "Store" s ON s."id" = o."storeId"
      WHERE o."createdAt" >= ${monthStart}
        AND o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
        AND o."paymentStatus" != 'REFUNDED'
      GROUP BY o."storeId", s."slug", s."name"
      ORDER BY gmv DESC
      LIMIT 5
    `,
  ]);

  // Búsqueda global cross-table cuando hay query
  let searchResults: {
    stores: { id: string; slug: string; name: string; status: string }[];
    users: { id: string; fullName: string | null; email: string | null; phone: string | null; role: string }[];
    invoices: { id: string; invoiceNumber: string; amount: number; status: string; store: { name: string; slug: string } }[];
  } | null = null;

  if (q.length >= 2) {
    const [matchStores, matchUsers, matchInvoices] = await Promise.all([
      db.store.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        select: { id: true, slug: true, name: true, status: true },
      }),
      db.user.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        select: { id: true, fullName: true, email: true, phone: true, role: true },
      }),
      db.invoice.findMany({
        where: { invoiceNumber: { contains: q, mode: "insensitive" } },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          status: true,
          store: { select: { name: true, slug: true } },
        },
      }),
    ]);

    searchResults = {
      stores: matchStores,
      users: matchUsers,
      invoices: matchInvoices.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
      })),
    };
  }

  const topNameById = new Map(
    topStoresByGmv.map((t) => [t.storeId, { slug: t.slug, name: t.name }]),
  );

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-6">
            <form method="GET" action="/admin" className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar tienda, usuario o factura…"
                autoComplete="off"
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
              />
            </form>
            <div className="ml-auto text-xs text-[color:var(--muted)]">
              {now.toLocaleDateString("es-BO", { dateStyle: "long" })}
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">

          {/* Resultados de búsqueda */}
          {searchResults && (
            <section className="mb-8 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <h2 className="font-semibold">
                Resultados para <span className="font-mono text-[color:var(--color-amber-600)]">&ldquo;{q}&rdquo;</span>
              </h2>

              {searchResults.stores.length === 0 &&
                searchResults.users.length === 0 &&
                searchResults.invoices.length === 0 && (
                  <p className="mt-4 text-sm text-[color:var(--muted)]">
                    Sin resultados. Prueba con otro término.
                  </p>
                )}

              {searchResults.stores.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[color:var(--muted)]">
                    Tiendas
                  </p>
                  <ul className="divide-y divide-[color:var(--line)]">
                    {searchResults.stores.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/admin/tiendas/${s.id}`}
                          className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-[color:var(--bg)] transition"
                        >
                          <StoreIcon className="size-4 shrink-0 text-[color:var(--muted)]" />
                          <span className="flex-1 text-sm font-medium">{s.name}</span>
                          <span className="font-mono text-xs text-[color:var(--muted)]">{s.slug}</span>
                          <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
                            {s.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {searchResults.users.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[color:var(--muted)]">
                    Usuarios
                  </p>
                  <ul className="divide-y divide-[color:var(--line)]">
                    {searchResults.users.map((u) => (
                      <li key={u.id}>
                        <Link
                          href={`/admin/usuarios?q=${encodeURIComponent(u.email ?? u.phone ?? u.fullName ?? u.id)}`}
                          className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-[color:var(--bg)] transition"
                        >
                          <Users className="size-4 shrink-0 text-[color:var(--muted)]" />
                          <span className="flex-1 text-sm font-medium">{u.fullName ?? "—"}</span>
                          <span className="text-xs text-[color:var(--muted)]">
                            {u.email ?? u.phone ?? "—"}
                          </span>
                          <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
                            {u.role}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {searchResults.invoices.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[color:var(--muted)]">
                    Facturas
                  </p>
                  <ul className="divide-y divide-[color:var(--line)]">
                    {searchResults.invoices.map((inv) => (
                      <li key={inv.id}>
                        <Link
                          href="/admin/cobranzas"
                          className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-[color:var(--bg)] transition"
                        >
                          <FileText className="size-4 shrink-0 text-[color:var(--muted)]" />
                          <span className="flex-1 text-sm font-medium">{inv.invoiceNumber}</span>
                          <span className="text-xs text-[color:var(--muted)]">{inv.store.name}</span>
                          <span className="text-xs font-medium">{formatBob(inv.amount)}</span>
                          <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
                            {inv.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Vista global
            </p>
            <h1 className="font-display mt-1 text-3xl">Madriguera Shop · {now.toLocaleDateString("es-BO", { month: "long", year: "numeric" })}</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {storeCount} tiendas · {activeStoreCount} activas · {pastDueCount} con pago atrasado · {suspendedCount} suspendidas
            </p>
          </div>

          {/* Action items */}
          {(awaitingProofInvoicesCount > 0 || pastDueCount > 0) && (
            <div className="mt-6 rounded-2xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <AlertTriangle className="size-4 text-[color:var(--color-amber-700)]" />
                {awaitingProofInvoicesCount > 0 && (
                  <Link
                    href="/admin/cobranzas?filter=with_proof"
                    className="font-medium text-[color:var(--color-amber-700)] hover:underline"
                  >
                    {awaitingProofInvoicesCount} comprobante
                    {awaitingProofInvoicesCount === 1 ? "" : "s"} por verificar
                  </Link>
                )}
                {pastDueCount > 0 && (
                  <Link
                    href="/admin/tiendas"
                    className="font-medium text-[color:var(--color-amber-700)] hover:underline"
                  >
                    {pastDueCount} tienda{pastDueCount === 1 ? "" : "s"} con pago atrasado
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <KpiCardCompact
              icon={StoreIcon}
              label="Tiendas activas"
              value={String(activeStoreCount)}
              hint={`${storeCount} totales`}
            />
            {/* `formatBob` acepta Decimal directamente — pasarle el Decimal
                preserva precisión. Antes se convertía con `Number()`, que
                con montos altos puede perder dígitos (Number max safe int
                es 2^53; Decimal(10,2) en BOB no llega cerca pero el cast
                es innecesariamente lossy). */}
            <KpiCardCompact
              icon={Wallet}
              label="Cobrado este mes"
              value={formatBob(invoicePaidThisMonth._sum.amount ?? 0)}
              hint={`${formatBob(invoicePendingTotal._sum.amount ?? 0)} pendiente`}
            />
            <KpiCardCompact
              icon={ShoppingBag}
              label="Pedidos del mes (red)"
              value={String(gmvThisMonth._count._all ?? 0)}
              hint={`GMV: ${formatBob(gmvThisMonth._sum.total ?? 0)}`}
            />
            <KpiCardCompact
              icon={TrendingUp}
              label="Facturas abiertas"
              value={String(awaitingInvoicesCount)}
              hint={`${awaitingProofInvoicesCount} con comprobante`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Recent stores */}
            <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Últimas tiendas registradas</h2>
                <Link
                  href="/admin/tiendas"
                  className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                >
                  Ver todas →
                </Link>
              </div>
              {recentStores.length === 0 ? (
                <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
                  Sin tiendas todavía. La primera registrada aparece acá.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[color:var(--line)]">
                  {recentStores.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/${s.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg transition hover:bg-[color:var(--bg)]"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color:var(--bg)] text-[color:var(--muted)]">
                          <StoreIcon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{s.name}</span>
                            <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
                              {s.status}
                            </span>
                          </div>
                          <p className="text-xs text-[color:var(--muted)]">
                            {s.vertical} · {s.city ?? "Bolivia"} · plan {s.plan.name}
                          </p>
                        </div>
                        <ExternalLink className="size-3.5 text-[color:var(--muted)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Top stores by GMV */}
            <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <h2 className="font-semibold">Top tiendas del mes</h2>
              <p className="text-xs text-[color:var(--muted)]">Por GMV (volumen vendido)</p>
              {topStoresByGmv.length === 0 ? (
                <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
                  Sin pedidos este mes todavía.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {topStoresByGmv.map((t, i) => {
                    const s = topNameById.get(t.storeId);
                    return (
                      <li key={t.storeId} className="flex items-center gap-3">
                        <span className="w-5 text-center text-xs font-bold text-[color:var(--muted)]">
                          {i + 1}
                        </span>
                        <Users className="size-4 shrink-0 text-[color:var(--muted)]" />
                        <span className="flex-1 truncate text-sm">
                          {s ? (
                            <Link
                              href={`/${s.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline inline-flex items-center gap-1"
                            >
                              {s.name}
                              <ArrowUpRight className="size-3" />
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="text-xs num-tabular text-[color:var(--muted)]">
                          {formatBob(t.gmv)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
      </main>
    </>
  );
}
