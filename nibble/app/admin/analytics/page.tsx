import type { ReactNode } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatBob } from "@/lib/utils";
import { verticalLabel } from "@/lib/saas/verticals";

export const metadata = { title: "Analytics · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireSuperAdmin();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  // ============== KPIs ==============

  // MRR: suma del valor mensualizado de cada subscripción ACTIVE/PAST_DUE.
  // Yearly se amortiza /12 para evitar el spike del mes que paga.
  type MrrRow = { mrr: number };
  const mrrRows = await db.$queryRaw<MrrRow[]>`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN s."billingCycle" = 'MONTHLY' THEN p."monthlyPriceBob"
          WHEN s."billingCycle" = 'YEARLY'  THEN p."yearlyPriceBob" / 12
          ELSE 0
        END
      ), 0)::float AS mrr
    FROM "Store" s
    JOIN "Plan" p ON p."id" = s."planId"
    WHERE s."status" IN ('ACTIVE', 'PAST_DUE')
  `;
  const mrr = Number(mrrRows[0]?.mrr ?? 0);
  const arr = mrr * 12;

  // GMV: total de pedidos pagados/entregados últimos 30d.
  type GmvRow = { gmv: number };
  const gmvRows = await db.$queryRaw<GmvRow[]>`
    SELECT COALESCE(SUM("total"), 0)::float AS gmv
    FROM "Order"
    WHERE "createdAt" >= ${thirtyDaysAgo}
      AND "paymentStatus" = 'VERIFIED'
      AND "status" <> 'CANCELLED'
  `;
  const gmv30d = Number(gmvRows[0]?.gmv ?? 0);

  const gmvPrevRows = await db.$queryRaw<GmvRow[]>`
    SELECT COALESCE(SUM("total"), 0)::float AS gmv
    FROM "Order"
    WHERE "createdAt" >= ${sixtyDaysAgo}
      AND "createdAt" < ${thirtyDaysAgo}
      AND "paymentStatus" = 'VERIFIED'
      AND "status" <> 'CANCELLED'
  `;
  const gmvPrev30d = Number(gmvPrevRows[0]?.gmv ?? 0);
  const gmvDelta = gmvPrev30d > 0 ? (gmv30d - gmvPrev30d) / gmvPrev30d : null;

  // Tiendas: activas, nuevas y churneadas
  const [activeStores, newThisMonth, churnedThisMonth, totalAtStart] = await Promise.all([
    db.store.count({ where: { status: { in: ["ACTIVE", "PAST_DUE"] } } }),
    db.store.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.store.count({
      where: {
        status: "CANCELLED",
        cancelledAt: { gte: thirtyDaysAgo },
      },
    }),
    db.store.count({
      where: {
        status: { in: ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] },
        createdAt: { lt: thirtyDaysAgo },
      },
    }),
  ]);
  const churnRate = totalAtStart > 0 ? (churnedThisMonth / totalAtStart) * 100 : 0;
  const arpu = activeStores > 0 ? mrr / activeStores : 0;

  // ============== Series temporales ==============

  // MRR mensual últimos 12 meses (basado en invoices PAID)
  type MonthlyRow = { bucket: Date; total: number };
  const mrrByMonth = await db.$queryRaw<MonthlyRow[]>`
    SELECT
      date_trunc('month', "paidAt")::timestamp AS bucket,
      COALESCE(SUM("amount"), 0)::float       AS total
    FROM "Invoice"
    WHERE "status" = 'PAID' AND "paidAt" >= ${yearAgo}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  // GMV semanal últimas 12 semanas
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const gmvByWeek = await db.$queryRaw<MonthlyRow[]>`
    SELECT
      date_trunc('week', "createdAt")::timestamp AS bucket,
      COALESCE(SUM("total"), 0)::float          AS total
    FROM "Order"
    WHERE "createdAt" >= ${twelveWeeksAgo}
      AND "paymentStatus" = 'VERIFIED'
      AND "status" <> 'CANCELLED'
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  // Distribución por vertical
  type VerticalRow = { vertical: string; count: bigint };
  const byVertical = await db.$queryRaw<VerticalRow[]>`
    SELECT "vertical", COUNT(*)::bigint AS count
    FROM "Store"
    WHERE "status" IN ('ACTIVE', 'PAST_DUE')
    GROUP BY "vertical"
    ORDER BY count DESC
  `;
  const verticalTotal = byVertical.reduce((s, v) => s + Number(v.count), 0);

  // Top 10 tiendas por GMV últimos 30d
  type TopStoreRow = {
    storeId: string;
    name: string;
    slug: string;
    vertical: string;
    gmv: number;
    orders: bigint;
  };
  const topStores = await db.$queryRaw<TopStoreRow[]>`
    SELECT
      o."storeId",
      s."name",
      s."slug",
      s."vertical",
      COALESCE(SUM(o."total"), 0)::float AS gmv,
      COUNT(*)::bigint AS orders
    FROM "Order" o
    JOIN "Store" s ON s."id" = o."storeId"
    WHERE o."createdAt" >= ${thirtyDaysAgo}
      AND o."paymentStatus" = 'VERIFIED'
      AND o."status" <> 'CANCELLED'
    GROUP BY o."storeId", s."name", s."slug", s."vertical"
    ORDER BY gmv DESC
    LIMIT 10
  `;

  // Conversión: pageviews vs órdenes últimos 30d
  const [pageViewCount, orderCount] = await Promise.all([
    db.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);
  const conversionRate = pageViewCount > 0 ? (orderCount / pageViewCount) * 100 : 0;

  return (
    <main className="p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Plataforma
            </p>
            <h1 className="font-display mt-1 text-3xl">Analytics de la red</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Métricas globales del SaaS — actualizadas en tiempo real.
            </p>
          </div>

          {/* KPI cards */}
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={<Wallet className="size-5" />}
              label="MRR"
              value={formatBob(mrr)}
              hint={`ARR: ${formatBob(arr)}`}
              tone="leaf"
            />
            <KpiCard
              icon={<TrendingUp className="size-5" />}
              label="GMV (30d)"
              value={formatBob(gmv30d)}
              delta={gmvDelta}
              hint="vs 30d previos"
              tone="amber"
            />
            <KpiCard
              icon={<Users className="size-5" />}
              label="Tiendas activas"
              value={String(activeStores)}
              hint={`+${newThisMonth} nuevas · ${churnedThisMonth} churn (30d)`}
              tone="sky"
            />
            <KpiCard
              icon={<ShoppingBag className="size-5" />}
              label="ARPU"
              value={formatBob(arpu)}
              hint={`${churnRate.toFixed(1)}% churn rate`}
              tone="violet"
            />
          </div>

          {/* Charts */}
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <ChartCard title="MRR mensual (últimos 12 meses)" subtitle="Suma de invoices pagadas por mes">
              <LineChartSVG
                data={fillMonthly(mrrByMonth, now, 12)}
                formatY={formatBob}
              />
            </ChartCard>
            <ChartCard title="GMV semanal (últimas 12 semanas)" subtitle="Pedidos verificados, no cancelados">
              <BarChartSVG
                data={fillWeekly(gmvByWeek, now, 12)}
                formatY={formatBob}
              />
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {/* Vertical distribution */}
            <ChartCard
              title="Distribución por vertical"
              subtitle={`${verticalTotal} tiendas activas`}
              className="lg:col-span-1"
            >
              <ul className="mt-4 space-y-3">
                {byVertical.map((v) => {
                  const count = Number(v.count);
                  const pct = verticalTotal > 0 ? (count / verticalTotal) * 100 : 0;
                  return (
                    <li key={v.vertical}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {verticalLabel(v.vertical)}
                        </span>
                        <span className="num-tabular text-[color:var(--muted)]">
                          {count} · {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color:var(--bg)]">
                        <div
                          className="h-full bg-[color:var(--color-amber-500)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ChartCard>

            {/* Top 10 */}
            <ChartCard
              title="Top 10 tiendas por GMV (30d)"
              subtitle="Pedidos verificados, no cancelados"
              className="lg:col-span-2"
            >
              {topStores.length === 0 ? (
                <p className="mt-4 text-sm text-[color:var(--muted)]">
                  Sin pedidos verificados en los últimos 30 días.
                </p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead className="text-xs uppercase text-[color:var(--muted)]">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">#</th>
                      <th className="px-2 py-2 text-left font-medium">Tienda</th>
                      <th className="hidden px-2 py-2 text-left font-medium md:table-cell">
                        Vertical
                      </th>
                      <th className="px-2 py-2 text-right font-medium">Pedidos</th>
                      <th className="px-2 py-2 text-right font-medium">GMV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--line)]">
                    {topStores.map((s, i) => (
                      <tr key={s.storeId}>
                        <td className="px-2 py-2 text-xs text-[color:var(--muted)] num-tabular">
                          {i + 1}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[color:var(--fg)] hover:underline"
                          >
                            {s.name}
                          </Link>
                        </td>
                        <td className="hidden px-2 py-2 text-xs text-[color:var(--muted)] md:table-cell">
                          {verticalLabel(s.vertical)}
                        </td>
                        <td className="px-2 py-2 text-right num-tabular">
                          {Number(s.orders)}
                        </td>
                        <td className="px-2 py-2 text-right num-tabular font-medium">
                          {formatBob(Number(s.gmv))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
          </div>

          {/* Conversion + métricas secundarias */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <SmallStat
              label="Conversión (visita → pedido)"
              value={`${conversionRate.toFixed(2)}%`}
              hint={`${pageViewCount.toLocaleString("es-BO")} visitas, ${orderCount} pedidos (30d)`}
            />
            <SmallStat
              label="Net new (30d)"
              value={`${newThisMonth - churnedThisMonth >= 0 ? "+" : ""}${newThisMonth - churnedThisMonth}`}
              hint={`+${newThisMonth} nuevas, -${churnedThisMonth} churn`}
            />
            <SmallStat
              label="Churn rate (30d)"
              value={`${churnRate.toFixed(1)}%`}
              hint={`${churnedThisMonth} cancelaciones / ${totalAtStart} al inicio`}
            />
          </div>
    </main>
  );
}

// ============== Card primitives ==============

function KpiCard({
  icon,
  label,
  value,
  hint,
  delta,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  tone: "amber" | "leaf" | "sky" | "violet";
}) {
  const toneClass: Record<typeof tone, string> = {
    amber: "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]",
    leaf: "bg-[color:var(--color-leaf-500)]/10 text-[color:var(--color-leaf-600)]",
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex items-start justify-between">
        <div className={`grid size-10 place-items-center rounded-xl ${toneClass[tone]}`}>
          {icon}
        </div>
        {delta !== undefined && delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              delta >= 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">{label}</p>
      <p className="font-display mt-1 text-2xl num-tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5 ${className ?? ""}`}
    >
      <h2 className="font-display text-lg">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-[color:var(--muted)]">{subtitle}</p>}
      {children}
    </section>
  );
}

function SmallStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="font-display mt-1 text-xl num-tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[color:var(--muted)]">{hint}</p>}
    </div>
  );
}

// ============== SVG Charts ==============

type Point = { label: string; value: number };

function LineChartSVG({
  data,
  formatY,
}: {
  data: Point[];
  formatY: (n: number) => string;
}) {
  if (data.length < 2) {
    return (
      <p className="mt-6 py-8 text-center text-sm text-[color:var(--muted)]">
        Sin datos suficientes todavía.
      </p>
    );
  }

  const W = 600;
  const H = 220;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 32;

  const max = Math.max(1, ...data.map((d) => d.value));
  const dx = (W - PAD_L - PAD_R) / Math.max(1, data.length - 1);
  const yScale = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${PAD_L + i * dx} ${yScale(d.value)}`)
    .join(" ");
  const area = `${path} L ${PAD_L + (data.length - 1) * dx} ${H - PAD_B} L ${PAD_L} ${H - PAD_B} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-amber-500)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-amber-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y axis labels (3 ticks) */}
      {[0, 0.5, 1].map((t) => {
        const v = max * (1 - t);
        return (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={PAD_T + t * (H - PAD_T - PAD_B)}
              y2={PAD_T + t * (H - PAD_T - PAD_B)}
              stroke="var(--line)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD_L - 8}
              y={PAD_T + t * (H - PAD_T - PAD_B) + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted)"
            >
              {formatY(v)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#lineGradient)" />
      <path d={path} fill="none" stroke="var(--color-amber-500)" strokeWidth="2" />
      {data.map((d, i) => (
        <g key={i}>
          <circle
            cx={PAD_L + i * dx}
            cy={yScale(d.value)}
            r={2.5}
            fill="var(--color-amber-500)"
          />
          {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
            <text
              x={PAD_L + i * dx}
              y={H - PAD_B + 16}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function BarChartSVG({
  data,
  formatY,
}: {
  data: Point[];
  formatY: (n: number) => string;
}) {
  if (data.length === 0) {
    return (
      <p className="mt-6 py-8 text-center text-sm text-[color:var(--muted)]">
        Sin datos suficientes todavía.
      </p>
    );
  }

  const W = 600;
  const H = 220;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 32;

  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = W - PAD_L - PAD_R;
  const barW = innerW / data.length;
  const yScale = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
      {[0, 0.5, 1].map((t) => {
        const v = max * (1 - t);
        return (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={PAD_T + t * (H - PAD_T - PAD_B)}
              y2={PAD_T + t * (H - PAD_T - PAD_B)}
              stroke="var(--line)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD_L - 8}
              y={PAD_T + t * (H - PAD_T - PAD_B) + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted)"
            >
              {formatY(v)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const y = yScale(d.value);
        const h = H - PAD_B - y;
        const x = PAD_L + i * barW + 2;
        const showLabel = i === data.length - 1 || i % 2 === 0;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(0, barW - 4)}
              height={Math.max(0, h)}
              rx={3}
              fill="var(--color-leaf-500)"
              opacity={0.85}
            />
            {showLabel && (
              <text
                x={x + (barW - 4) / 2}
                y={H - PAD_B + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted)"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============== Bucket helpers ==============

function fillMonthly(rows: { bucket: Date; total: number }[], now: Date, months: number): Point[] {
  const map = new Map(rows.map((r) => [monthKey(r.bucket), Number(r.total)]));
  const out: Point[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    out.push({
      label: d.toLocaleDateString("es-BO", { month: "short" }),
      value: map.get(key) ?? 0,
    });
  }
  return out;
}

function fillWeekly(rows: { bucket: Date; total: number }[], now: Date, weeks: number): Point[] {
  const map = new Map(rows.map((r) => [weekKey(r.bucket), Number(r.total)]));
  const out: Point[] = [];
  // Todo en UTC para que coincida con `date_trunc('week')` de Postgres
  // (que devuelve lunes UTC). Mezclar getDay/getUTCDay produce mismatch
  // de zona horaria y todas las semanas vienen en cero.
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  const day = monday.getUTCDay() || 7; // 1..7 (lunes=1, domingo=7)
  monday.setUTCDate(monday.getUTCDate() - day + 1);

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = weekKey(d);
    out.push({
      label: d.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      }),
      value: map.get(key) ?? 0,
    });
  }
  return out;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function weekKey(d: Date): string {
  // ISO yyyy-mm-dd del lunes UTC.
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
