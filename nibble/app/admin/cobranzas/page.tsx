import Link from "next/link";
import { ArrowUpRight, Search, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatBob } from "@/lib/utils";
import { InvoiceAdminActions } from "@/components/admin/cobranzas/InvoiceAdminActions";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = {
  title: "Cobranzas · Admin",
};

const PAGE_SIZE = 50;

const FILTER_TABS: {
  key: "open" | "with_proof" | "overdue" | "paid" | "all";
  label: string;
}[] = [
  { key: "with_proof", label: "Con comprobante" },
  { key: "open", label: "Abiertas" },
  { key: "overdue", label: "Vencidas" },
  { key: "paid", label: "Pagadas" },
  { key: "all", label: "Todas" },
];

function whereForFilter(filter: string) {
  switch (filter) {
    case "open":
      return { status: { in: ["PENDING" as const, "OVERDUE" as const] } };
    case "with_proof":
      return {
        status: { in: ["PENDING" as const, "OVERDUE" as const] },
        paidProofUrl: { not: null },
      };
    case "overdue":
      return { status: "OVERDUE" as const };
    case "paid":
      return { status: "PAID" as const };
    default:
      return {};
  }
}

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const filter = sp.filter ?? "with_proof";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const searchClause = q
    ? {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" as const } },
          { store: { name: { contains: q, mode: "insensitive" as const } } },
          { store: { slug: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const where = { ...whereForFilter(filter), ...searchClause };

  const [invoices, total, withProofCount, openCount, overdueCount, sumOpen] =
    await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          store: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              whatsappPhone: true,
              plan: { select: { name: true } },
            },
          },
        },
      }),
      db.invoice.count({ where }),
      db.invoice.count({
        where: {
          status: { in: ["PENDING", "OVERDUE"] },
          paidProofUrl: { not: null },
        },
      }),
      db.invoice.count({ where: { status: { in: ["PENDING", "OVERDUE"] } } }),
      db.invoice.count({ where: { status: "OVERDUE" } }),
      db.invoice.aggregate({
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        _sum: { amount: true },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "with_proof") params.set("filter", filter);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/cobranzas${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-6">
            <form action="/admin/cobranzas" className="relative w-72 max-w-full">
              <input type="hidden" name="filter" value={filter} />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por # factura o tienda"
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
            </form>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Super Admin
              </p>
              <h1 className="font-display mt-1 text-3xl">Cobranzas</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {openCount} factura{openCount === 1 ? "" : "s"} abiertas ·{" "}
                {withProofCount} esperando verificación · {overdueCount} vencidas
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
              <p className="text-xs text-[color:var(--muted)]">Por cobrar</p>
              <p className="font-display mt-1 text-2xl num-tabular">
                {formatBob(Number(sumOpen._sum.amount ?? 0))}
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {FILTER_TABS.map((t) => {
              const isActive = filter === t.key;
              const badge =
                t.key === "with_proof"
                  ? withProofCount
                  : t.key === "open"
                    ? openCount
                    : t.key === "overdue"
                      ? overdueCount
                      : null;
              return (
                <Link
                  key={t.key}
                  href={`/admin/cobranzas?filter=${t.key}`}
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
                        isActive ? "bg-white/15 text-white/90" : "bg-[color:var(--bg)] text-[color:var(--muted)]"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Lista */}
          <div className="mt-6">
            {invoices.length === 0 ? (
              <EmptyState
                className="border-solid"
                icon={<Wallet className="size-8" />}
                description="No hay facturas para mostrar."
              />
            ) : (
              <ul className="space-y-3">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5"
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_180px_220px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm">{inv.invoiceNumber}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            inv.status === "OVERDUE"
                              ? "bg-red-100 text-red-700"
                              : inv.status === "PAID"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                          }`}>
                            {inv.status}
                          </span>
                          {inv.paidProofUrl && (
                            <span className="rounded-full bg-[color:var(--color-amber-100)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-amber-700)]">
                              Comprobante listo
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/${inv.store.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                        >
                          {inv.store.name}
                          <ArrowUpRight className="size-3.5 text-[color:var(--muted)]" />
                        </Link>
                        <p className="text-xs text-[color:var(--muted)]">
                          Plan {inv.store.plan.name} · Tienda {inv.store.status}
                        </p>
                        <p className="text-xs text-[color:var(--muted)]">
                          Vence: {inv.dueDate.toLocaleDateString("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" })}
                          {inv.paidAt &&
                            ` · Pagada: ${inv.paidAt.toLocaleDateString("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" })}`}
                        </p>
                        {inv.notes && (
                          <p className="mt-1 text-xs italic text-[color:var(--muted)]">
                            {inv.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase text-[color:var(--muted)]">
                            Monto
                          </p>
                          <p className="font-display text-2xl num-tabular">
                            {formatBob(Number(inv.amount))}
                          </p>
                        </div>
                        {inv.paidProofUrl && (
                          <a
                            href={inv.paidProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block max-w-full"
                          >
                            <div className="aspect-square w-32 overflow-hidden rounded-lg border border-[color:var(--line-strong)] bg-white p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={inv.paidProofUrl}
                                alt="Comprobante"
                                className="size-full object-contain"
                              />
                            </div>
                          </a>
                        )}
                      </div>

                      <div>
                        {inv.status === "PAID" || inv.status === "CANCELLED" ? (
                          <p className="text-xs text-[color:var(--muted)]">
                            {inv.status === "PAID" ? "Pago verificado." : "Factura cancelada."}
                          </p>
                        ) : (
                          <InvoiceAdminActions
                            invoiceId={inv.id}
                            hasProof={Boolean(inv.paidProofUrl)}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="factura"
            buildPageHref={buildPageHref}
          />
        </main>
    </>
  );
}
