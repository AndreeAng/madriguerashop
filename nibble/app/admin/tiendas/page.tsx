import Link from "next/link";
import { ExternalLink, Plus, Search, Store as StoreIcon } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatBob } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { verticalLabel } from "@/lib/saas/verticals";

export const metadata = { title: "Tiendas · Admin" };

const STATUS_CHIPS: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  TRIAL: { label: "Prueba", bg: "bg-amber-100", fg: "text-amber-700" },
  ACTIVE: { label: "Activa", bg: "bg-emerald-100", fg: "text-emerald-700" },
  PAST_DUE: { label: "Pago atrasado", bg: "bg-orange-100", fg: "text-orange-700" },
  SUSPENDED: { label: "Suspendida", bg: "bg-red-100", fg: "text-red-700" },
  CANCELLED: { label: "Cancelada", bg: "bg-gray-100", fg: "text-gray-700" },
};

const FILTER_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Activas" },
  { key: "past_due", label: "Pago atrasado" },
  { key: "suspended", label: "Suspendidas" },
];

function whereForFilter(filter: string) {
  switch (filter) {
    case "active":
      return { status: "ACTIVE" as const };
    case "past_due":
      return { status: "PAST_DUE" as const };
    case "suspended":
      return { status: "SUSPENDED" as const };
    default:
      return {};
  }
}

const PAGE_SIZE = 50;

export default async function AdminTiendasPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const filter = sp.filter ?? "all";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const searchClause = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where = { ...whereForFilter(filter), ...searchClause };

  const [stores, total] = await Promise.all([
    db.store.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        plan: { select: { name: true, monthlyPriceBob: true } },
        _count: {
          select: {
            products: true,
            orders: { where: { createdAt: { gte: monthStart } } },
            // Owners activos: si === 0, mostramos badge "Sin owner" en la fila.
            // Usar `_count` evita traer el array entero por tienda.
            users: {
              where: { role: Role.STORE_OWNER, isActive: true },
            },
          },
        },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.store.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("filter", filter);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/tiendas${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-6">
            <form action="/admin/tiendas" className="relative w-72 max-w-full">
              <input type="hidden" name="filter" value={filter} />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre, slug o ciudad"
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
            </form>
            <Link
              href="/admin/tiendas/nueva"
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              <Plus className="size-4" />
              Nueva tienda
            </Link>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Catálogo de tiendas
            </p>
            <h1 className="font-display mt-1 text-3xl">Tiendas</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {stores.length} tiendas en el filtro actual
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {FILTER_TABS.map((t) => {
              const isActive = filter === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/admin/tiendas?filter=${t.key}`}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    isActive
                      ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                      : "border-[color:var(--line)] bg-[color:var(--card)] text-[color:var(--fg-soft)] hover:border-[color:var(--color-bark-300)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 overflow-x-auto rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
            {stores.length === 0 ? (
              <div className="p-10 text-center">
                <StoreIcon className="mx-auto size-8 text-[color:var(--muted)]" />
                <p className="mt-3 text-[color:var(--muted)]">
                  No hay tiendas en este filtro.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--bg)] text-xs uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Tienda</th>
                    <th className="hidden px-3 py-3 text-left font-medium md:table-cell">
                      Tipo
                    </th>
                    <th className="px-3 py-3 text-left font-medium">Estado</th>
                    <th className="hidden px-3 py-3 text-left font-medium md:table-cell">
                      Plan
                    </th>
                    <th className="hidden px-3 py-3 text-right font-medium md:table-cell">
                      Productos
                    </th>
                    <th className="hidden px-3 py-3 text-right font-medium md:table-cell">
                      Pedidos mes
                    </th>
                    <th className="px-3 py-3 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {stores.map((s) => {
                    const chip = STATUS_CHIPS[s.status] ?? STATUS_CHIPS.ACTIVE;
                    return (
                      <tr key={s.id}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg text-[11px] font-bold text-white"
                              style={{ background: s.primaryColor }}
                            >
                              {s.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={s.logoUrl}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                s.name
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((w) => w[0]?.toUpperCase() ?? "")
                                  .join("")
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {s.name}
                              </p>
                              <p className="font-mono text-xs text-[color:var(--muted)]">
                                /{s.slug} · {s.city ?? "Bolivia"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          {verticalLabel(s.vertical)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip!.bg} ${chip!.fg}`}
                          >
                            {chip!.label}
                          </span>
                          {s._count.users === 0 && (
                            <span
                              className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                              title="Esta tienda no tiene owner activo — asigná uno desde el detalle."
                            >
                              Sin owner
                            </span>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          <span className="text-[color:var(--fg)]">
                            {s.plan.name}
                          </span>
                          <span className="ml-1.5 text-xs text-[color:var(--muted)]">
                            {formatBob(Number(s.plan.monthlyPriceBob))}/mes
                          </span>
                        </td>
                        <td className="hidden px-3 py-3 text-right num-tabular md:table-cell">
                          {s._count.products}
                        </td>
                        <td className="hidden px-3 py-3 text-right num-tabular md:table-cell">
                          {s._count.orders}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/admin/tiendas/${s.id}`}
                              className="rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs hover:border-[color:var(--color-bark-300)]"
                            >
                              Detalle
                            </Link>
                            <Link
                              href={`/${s.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Ver storefront"
                              className="grid size-7 place-items-center rounded-lg border border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--color-bark-300)] hover:text-[color:var(--fg)]"
                            >
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="tienda"
            buildPageHref={buildPageHref}
          />
        </main>
    </>
  );
}
