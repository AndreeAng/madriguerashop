import {
  TrendingUp,
  Store as StoreIcon,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { stores } from "@/lib/mock/stores";
import { formatBob } from "@/lib/utils";

export default function AdminHome() {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <div className="flex-1">
        <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-6">
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                placeholder="Buscar tiendas, usuarios, facturas..."
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="hidden text-[color:var(--muted)] md:inline">28 abr 2026 · Cochabamba</span>
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Salud del SaaS
              </p>
              <h1 className="font-display mt-1 text-3xl">Resumen ejecutivo</h1>
            </div>
            <div className="hidden items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] p-1 text-xs md:flex">
              {["7d", "30d", "90d", "Año"].map((t, i) => (
                <button
                  key={t}
                  className={`rounded-full px-3 py-1.5 ${i === 1 ? "bg-[color:var(--color-bark-900)] text-white" : "text-[color:var(--muted)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <KpiCard icon={Wallet} label="MRR" value={formatBob(69000)} delta={+12} sub="138 tiendas activas" />
            <KpiCard icon={TrendingUp} label="ARR proyectado" value={formatBob(828000)} delta={+18} sub="≈ USD 119k al cambio oficial" />
            <KpiCard icon={StoreIcon} label="Tiendas activas" value="138" delta={+9} sub="14 trial · 4 past due" />
            <KpiCard icon={Users} label="Churn 30d" value="3.6%" delta={-1} sub="5 tiendas canceladas" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Tiendas</h2>
                <button className="rounded-full bg-[color:var(--color-bark-900)] px-3 py-1.5 text-xs font-medium text-white">
                  + Nueva tienda
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--line)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--line)] bg-[color:var(--bg)] text-xs uppercase tracking-wider text-[color:var(--muted)]">
                      <th className="px-4 py-3 text-left">Tienda</th>
                      <th className="px-4 py-3 text-left">Vertical</th>
                      <th className="px-4 py-3 text-left">Pedidos/mes</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((s, i) => (
                      <tr key={s.slug} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--bg)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                              style={{ background: s.primaryColor }}
                            >
                              {s.logoEmoji}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{s.name}</p>
                              <p className="text-xs text-[color:var(--muted)]">{s.city}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="rounded-full bg-[color:var(--bg)] px-2 py-1">
                            {s.vertical}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{s.ordersThisMonth}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                              i === 5
                                ? "bg-yellow-100 text-yellow-700"
                                : i === 4
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {i === 5 ? "Past Due" : i === 4 ? "Trial" : "Activa"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="rounded-md p-1 text-[color:var(--muted)] hover:bg-[color:var(--line)]">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-5">
                <div className="flex items-center gap-2 text-[color:var(--color-amber-700)]">
                  <AlertTriangle className="size-4" />
                  <h3 className="text-sm font-semibold">Cobranza</h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span>4 facturas vencidas</span>
                    <a className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline" href="#">Cobrar</a>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>3 comprobantes por verificar</span>
                    <a className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline" href="#">Verificar</a>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>2 tiendas a un día de suspender</span>
                    <a className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline" href="#">Avisar</a>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="font-semibold">MRR por mes</h3>
                <p className="mt-1 text-xs text-[color:var(--muted)]">Crecimiento últimos 6 meses</p>
                <div className="mt-4 flex h-32 items-end gap-2">
                  {[28, 36, 42, 51, 58, 69].map((v, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[color:var(--color-amber-500)] to-[color:var(--color-amber-300)]"
                        style={{ height: `${(v / 70) * 100}%` }}
                      />
                      <span className="text-[10px] text-[color:var(--muted)]">{["nov", "dic", "ene", "feb", "mar", "abr"][i]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-[color:var(--muted)]">Bs 28k</span>
                  <span className="font-semibold text-[color:var(--color-leaf-600)]">+147% en 6 meses</span>
                </div>
              </div>

              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="font-semibold">Distribución por vertical</h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {[
                    ["Restaurante", 42, "bg-rose-400"],
                    ["Retail", 33, "bg-amber-400"],
                    ["Food Truck", 14, "bg-emerald-400"],
                    ["Ferretería", 7, "bg-blue-400"],
                    ["Servicios", 4, "bg-purple-400"],
                  ].map(([name, pct, bg]) => (
                    <li key={name as string}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{name}</span>
                        <span className="text-[color:var(--muted)]">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--bg)]">
                        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Mapa de calor nacional — pedidos últimos 30 días</h2>
            <p className="text-xs text-[color:var(--muted)]">
              Cochabamba domina con 58% del GMV. La Paz crece 23% mes a mes. Oportunidad: Tarija (0 tiendas).
            </p>
            <div className="relative mt-4 h-80 overflow-hidden rounded-2xl bg-[color:var(--bg)]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 35% 55%, rgba(245,158,11,0.6), transparent 12%), radial-gradient(circle at 28% 45%, rgba(220,38,38,0.5), transparent 14%), radial-gradient(circle at 55% 35%, rgba(245,158,11,0.4), transparent 11%), radial-gradient(circle at 70% 60%, rgba(245,158,11,0.3), transparent 10%)",
                }}
              />
              <div className="absolute inset-0 grid place-items-center">
                <p className="font-display rotate-[-5deg] text-7xl text-[color:var(--color-bark-900)]/20">Bolivia</p>
              </div>
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs">
                <span className="size-2 rounded-full bg-[color:var(--color-amber-500)]" />
                <span>1.842 pedidos · {formatBob(187400)} GMV</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  delta: number;
  sub: string;
}) {
  const positive = delta >= 0;
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[color:var(--bg)] text-[color:var(--color-amber-600)]">
          <Icon className="size-4" />
        </div>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(delta)}%
        </span>
      </div>
      <p className="mt-4 text-xs text-[color:var(--muted)]">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--muted)]">{sub}</p>
    </div>
  );
}
