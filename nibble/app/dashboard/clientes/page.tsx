import Link from "next/link";
import { ArrowUpRight, Phone, Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { formatBob, formatWaPhone } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { dashboardCopy } from "@/lib/dashboard/copy";

export const metadata = { title: "Clientes · Madriguera Shop" };

const PAGE_SIZE = 50;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { store } = await requireStoreOwner();
  const copy = dashboardCopy(store.vertical);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    storeId: store.id,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  // Las 4 queries son independientes — corren en paralelo para bajar TTFB.
  const [customers, total, totalCustomers, recurrentCount] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
    db.customer.count({ where: { storeId: store.id } }),
    db.customer.count({
      where: { storeId: store.id, ordersCount: { gt: 1 } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/dashboard/clientes${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <DashboardHeader
        storeSlug={store.slug}
        leftSlot={
          <form action="/dashboard/clientes" className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, teléfono o email"
              className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
            />
          </form>
        }
      />

      <main className="p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Tu base
              </p>
              <h1 className="font-display mt-1 text-3xl">Clientes</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {totalCustomers} {totalCustomers === 1 ? "cliente" : "clientes"} ·{" "}
                {recurrentCount} recurrente{recurrentCount === 1 ? "" : "s"}
                {q && total !== totalCustomers && (
                  <span className="ml-1.5 text-[color:var(--color-amber-600)]">
                    · {total} {total === 1 ? "match" : "matches"} para &ldquo;{q}&rdquo;
                  </span>
                )}
              </p>
            </div>
            {/* Download endpoint: `<a>` con full reload, NO `<Link>`. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/export/customers"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--bg)]"
            >
              ↓ Exportar CSV
            </a>
          </div>

          <div className="mt-8 overflow-x-auto rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
            {customers.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="mx-auto size-8 text-[color:var(--muted)]" />
                <p className="mt-3 text-[color:var(--muted)]">
                  {q
                    ? "No se encontraron clientes con esa búsqueda."
                    : `Tus clientes aparecen acá apenas hagan ${copy.orderSingular === "solicitud" ? "su primera" : "su primer"} ${copy.orderSingular}.`}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--bg)] text-xs uppercase text-[color:var(--muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left font-medium">Cliente</th>
                    <th scope="col" className="hidden px-3 py-3 text-left font-medium md:table-cell">
                      Teléfono
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">{copy.ordersLabel}</th>
                    <th scope="col" className="hidden px-3 py-3 text-right font-medium md:table-cell">
                      Total gastado
                    </th>
                    <th scope="col" className="hidden px-3 py-3 text-right font-medium md:table-cell">
                      Último {copy.orderSingular}
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {customers.map((c) => {
                    const phoneDigits = formatWaPhone(c.phone);
                    return (
                      <tr key={c.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium">{c.fullName}</p>
                          {c.email && (
                            <p className="text-xs text-[color:var(--muted)]">{c.email}</p>
                          )}
                          {c.lastAddressText && (
                            <p className="text-xs text-[color:var(--muted)]">
                              📍 {c.lastAddressText}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 num-tabular md:table-cell">
                          {c.phone}
                        </td>
                        <td className="px-3 py-3 text-right num-tabular">
                          {c.ordersCount}
                          {c.ordersCount > 1 && (
                            <span className="ml-1.5 inline-flex rounded-full bg-[color:var(--color-amber-100)] px-1.5 text-[10px] font-medium uppercase text-[color:var(--color-amber-700)]">
                              VIP
                            </span>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 text-right num-tabular md:table-cell">
                          {formatBob(Number(c.totalSpent))}
                        </td>
                        <td className="hidden px-3 py-3 text-right md:table-cell">
                          {c.lastOrderAt ? (
                            <span className="text-xs text-[color:var(--muted)]">
                              {c.lastOrderAt.toLocaleDateString("es-BO", {
                                day: "2-digit",
                                month: "short",
                                timeZone: "America/La_Paz",
                              })}
                            </span>
                          ) : (
                            <span className="text-xs text-[color:var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`https://wa.me/${phoneDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`WhatsApp a ${c.fullName}`}
                              className="grid size-8 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--bg)] hover:text-[#25D366]"
                            >
                              <Phone className="size-4" />
                            </Link>
                            <Link
                              href={`/dashboard/clientes/${c.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs hover:border-[color:var(--color-bark-300)]"
                            >
                              Ver <ArrowUpRight className="size-3" />
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
          itemLabel="cliente"
          buildPageHref={buildPageHref}
        />
      </main>
    </>
  );
}
