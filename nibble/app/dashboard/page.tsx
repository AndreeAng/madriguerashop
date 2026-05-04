import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  Users,
  Bell,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Volume2,
} from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { orders, type OrderStatus } from "@/lib/mock/orders";
import { products } from "@/lib/mock/products";
import { formatBob } from "@/lib/utils";

const statusStyle: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  PENDING_PAYMENT: { label: "Pago pendiente", bg: "bg-yellow-100", fg: "text-yellow-700" },
  NEW: { label: "Nuevo", bg: "bg-amber-100", fg: "text-amber-700" },
  CONFIRMED: { label: "Confirmado", bg: "bg-blue-100", fg: "text-blue-700" },
  PREPARING: { label: "Preparando", bg: "bg-purple-100", fg: "text-purple-700" },
  IN_DELIVERY: { label: "En camino", bg: "bg-indigo-100", fg: "text-indigo-700" },
  DELIVERED: { label: "Entregado", bg: "bg-emerald-100", fg: "text-emerald-700" },
  CANCELLED: { label: "Cancelado", bg: "bg-red-100", fg: "text-red-700" },
};

export default function DashboardHome() {
  const topProducts = products.slice(0, 5);

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />

      <div className="flex-1">
        <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-6">
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                placeholder="Buscar pedidos, productos, clientes..."
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="relative inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--line)]">
                <Bell className="size-4" />
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[color:var(--color-amber-500)]" />
              </button>
              <div className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 text-xs">
                <Volume2 className="size-3.5 text-[color:var(--color-leaf-500)]" />
                <span className="font-medium">Sonido activo</span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Hola, Diego
              </p>
              <h1 className="font-display mt-1 text-3xl">Tu tienda hoy</h1>
            </div>
            <div className="hidden items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] p-1 text-xs md:flex">
              {["Hoy", "7d", "30d", "90d"].map((t, i) => (
                <button
                  key={t}
                  className={`rounded-full px-3 py-1.5 ${i === 0 ? "bg-[color:var(--color-bark-900)] text-white" : "text-[color:var(--muted)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <KpiCard icon={ShoppingBag} label="Pedidos hoy" value="14" delta={+24} />
            <KpiCard icon={Wallet} label="Ventas hoy" value={formatBob(1287)} delta={+18} />
            <KpiCard icon={TrendingUp} label="Ticket promedio" value={formatBob(92)} delta={-3} />
            <KpiCard icon={Users} label="Clientes nuevos" value="6" delta={+12} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Pedidos en vivo</h2>
                <a className="inline-flex items-center text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]" href="#">
                  Ver todos <ChevronRight className="ml-0.5 size-3.5" />
                </a>
              </div>

              <ul className="mt-4 divide-y divide-[color:var(--line)]">
                {orders.slice(0, 5).map((o) => {
                  const st = statusStyle[o.status];
                  return (
                    <li key={o.id} className="flex items-center gap-3 py-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${st.bg} ${st.fg}`}>
                        <ShoppingBag className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">#{o.number}</span>
                          <span className="text-sm">{o.customerName}</span>
                          <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium md:inline ${st.bg} ${st.fg}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[color:var(--muted)]">{o.itemsSummary}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatBob(o.total)}</p>
                        <p className="text-xs text-[color:var(--muted)]">{o.createdAt}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-5">
                <div className="flex items-center gap-2 text-[color:var(--color-amber-700)]">
                  <AlertTriangle className="size-4" />
                  <h3 className="text-sm font-semibold">Necesitan tu atención</h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span>2 comprobantes por verificar</span>
                    <a href="#" className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline">Revisar</a>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>3 productos con stock bajo</span>
                    <a href="#" className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline">Ver lista</a>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Factura Bs 500 vence en 3 días</span>
                    <a href="#" className="text-xs font-semibold text-[color:var(--color-amber-700)] hover:underline">Pagar</a>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="font-semibold">Top productos hoy</h3>
                <ul className="mt-4 space-y-3">
                  {topProducts.map((p, i) => (
                    <li key={p.slug} className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold text-[color:var(--muted)]">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm">{p.name}</span>
                      <span className="text-xs text-[color:var(--muted)]">{12 - i} ventas</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Mapa de calor — pedidos últimos 30 días</h2>
            <p className="text-xs text-[color:var(--muted)]">El 62% de tus pedidos viene de Cala Cala. Considerá una promo en Tupuraya.</p>
            <div className="relative mt-4 h-72 overflow-hidden rounded-2xl bg-[color:var(--bg)]">
              <img
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1600&q=80"
                alt=""
                className="h-full w-full object-cover opacity-50"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 35% 45%, rgba(245,158,11,0.55), transparent 18%), radial-gradient(circle at 55% 60%, rgba(220,38,38,0.45), transparent 14%), radial-gradient(circle at 70% 40%, rgba(245,158,11,0.35), transparent 10%), radial-gradient(circle at 25% 70%, rgba(245,158,11,0.25), transparent 9%)",
                }}
              />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs">
                <span className="size-2 rounded-full bg-[color:var(--color-amber-500)]" />
                <span>412 pedidos · {formatBob(38500)} en ventas</span>
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
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  delta: number;
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
      <div className="mt-4">
        <p className="text-xs text-[color:var(--muted)]">{label}</p>
        <p className="font-display mt-1 text-2xl">{value}</p>
      </div>
    </div>
  );
}
