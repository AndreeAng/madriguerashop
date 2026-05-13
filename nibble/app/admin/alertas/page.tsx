import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { Prisma, AlertStatus, AlertType, AlertSeverity } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { AlertActions } from "@/components/admin/alertas/AlertActions";
import { Pagination } from "@/components/ui/Pagination";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { EmptyState } from "@/components/ui/EmptyState";

const ALERT_TYPES: AlertType[] = ["CRON_FAILED", "PROOF_REUSED", "LOGIN_ATTACK", "STORE_TRAFFIC_DROP"];

function parseAlertType(input: unknown): AlertType | undefined {
  return typeof input === "string" && (ALERT_TYPES as string[]).includes(input)
    ? (input as AlertType)
    : undefined;
}

export const metadata = { title: "Alertas · Admin" };

const TYPE_LABELS: Record<AlertType, string> = {
  CRON_FAILED: "Cron caído",
  PROOF_REUSED: "Comprobante reusado",
  LOGIN_ATTACK: "Login attack",
  STORE_TRAFFIC_DROP: "Caída de tráfico",
};

const SEVERITY_TONE: Record<AlertSeverity, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const STATUS_FILTERS: { key: string; label: string; status: AlertStatus | "all" }[] = [
  { key: "open", label: "Abiertas", status: "OPEN" },
  { key: "acknowledged", label: "Reconocidas", status: "ACKNOWLEDGED" },
  { key: "resolved", label: "Resueltas", status: "RESOLVED" },
  { key: "all", label: "Todas", status: "all" },
];

const PAGE_SIZE = 50;

export default async function AdminAlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const statusKey = sp.status ?? "open";
  const typeFilter = parseAlertType(sp.type);
  const page = Math.max(1, Number(sp.page) || 1);

  const tab =
    STATUS_FILTERS.find((f) => f.key === statusKey) ?? STATUS_FILTERS[0]!;

  const where: Prisma.AlertWhereInput = {
    ...(tab.status !== "all" ? { status: tab.status } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const [alerts, total, openCount, criticalCount] = await Promise.all([
    db.alert.findMany({
      where,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        store: { select: { slug: true, name: true } },
      },
    }),
    db.alert.count({ where }),
    db.alert.count({ where: { status: "OPEN" } }),
    db.alert.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (statusKey !== "open") params.set("status", statusKey);
    if (typeFilter) params.set("type", typeFilter);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/alertas${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="p-6 lg:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Operación
              </p>
              <h1 className="font-display mt-1 text-3xl">Alertas</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {openCount} abierta{openCount === 1 ? "" : "s"}
                {criticalCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    {criticalCount} crítica{criticalCount === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <FilterTabs
            className="mt-6"
            activeKey={statusKey}
            items={STATUS_FILTERS.map((f) => ({
              key: f.key,
              label: f.label,
              href: `/admin/alertas?status=${f.key}${typeFilter ? `&type=${typeFilter}` : ""}`,
            }))}
          />

          <FilterTabs
            className="mt-3"
            activeKey={typeFilter ?? ""}
            items={[
              {
                key: "",
                label: "Todos los tipos",
                href: `/admin/alertas?status=${statusKey}`,
              },
              ...ALERT_TYPES.map((t) => ({
                key: t,
                label: TYPE_LABELS[t],
                href: `/admin/alertas?status=${statusKey}&type=${t}`,
              })),
            ]}
          />

          <div className="mt-6 space-y-3">
            {alerts.length === 0 ? (
              <EmptyState
                className="border-solid"
                icon={<CheckCircle2 className="size-8 text-[color:var(--color-leaf-500)]" />}
                description="Sin alertas en este filtro. Todo limpio por ahora."
              />
            ) : (
              alerts.map((a) => (
                <article
                  key={a.id}
                  className={`rounded-2xl border bg-[color:var(--card)] p-5 ${
                    a.status === "OPEN"
                      ? a.severity === "CRITICAL"
                        ? "border-red-300"
                        : a.severity === "HIGH"
                          ? "border-orange-300"
                          : "border-[color:var(--line-strong)]"
                      : "border-[color:var(--line)] opacity-70"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_TONE[a.severity]}`}
                        >
                          {a.severity}
                        </span>
                        <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--muted)]">
                          {TYPE_LABELS[a.type]}
                        </span>
                        {a.status === "ACKNOWLEDGED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <Clock className="size-3" /> Reconocida
                          </span>
                        )}
                        {a.status === "RESOLVED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="size-3" /> Resuelta
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-semibold text-[color:var(--fg)]">{a.title}</h3>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">{a.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--muted)]">
                        <span>
                          Detectada{" "}
                          {a.createdAt.toLocaleString("es-BO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                        {a.store && (
                          <Link
                            href={`/${a.store.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[color:var(--fg)] underline decoration-[color:var(--line)] underline-offset-4 hover:decoration-[color:var(--color-amber-400)]"
                          >
                            Tienda: {a.store.name}
                          </Link>
                        )}
                      </div>
                      {a.data && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-[color:var(--muted)]">
                            Detalles
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-[color:var(--bg)] p-3 text-[11px]">
                            {JSON.stringify(a.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <AlertActions alertId={a.id} status={a.status} />
                  </div>
                </article>
              ))
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="alerta"
            buildPageHref={buildPageHref}
          />

          <div className="mt-8 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 text-xs text-[color:var(--muted)]">
            <p className="flex items-center gap-2">
              <AlertCircle className="size-4" />
              La detección corre dentro del cron de billing (1×/día). Las
              alertas son idempotentes — si la misma condición vuelve a
              dispararse, no se duplica la fila.
            </p>
          </div>
    </main>
  );
}


