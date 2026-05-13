import { Bell, Search, ChevronDown, MapPin } from "lucide-react";

// Datos ilustrativos para el preview del dashboard en la landing.
// Es decoración: NO se conecta a DB porque la landing es pública/estática.
type PreviewOrder = {
  id: string;
  number: number;
  customerName: string;
  itemsSummary: string;
  zone?: string;
  total: number;
  status: keyof typeof STATUS_LABEL;
};

const PREVIEW_ORDERS: PreviewOrder[] = [
  {
    id: "1",
    number: 1247,
    customerName: "Carla Mendoza",
    itemsSummary: "12 Wings BBQ + Cheese Fries",
    zone: "Cala Cala",
    total: 96,
    status: "NEW",
  },
  {
    id: "2",
    number: 1246,
    customerName: "Marco Vargas",
    itemsSummary: "Combo Familiar + 2 Limonadas",
    zone: "Tupuraya",
    total: 165,
    status: "PREPARING",
  },
  {
    id: "3",
    number: 1245,
    customerName: "Ana Salazar",
    itemsSummary: "Buffalo Hot · 12 piezas",
    zone: "Recoleta",
    total: 58,
    status: "IN_DELIVERY",
  },
  {
    id: "4",
    number: 1244,
    customerName: "Diego Rojas",
    itemsSummary: "Honey Mustard + Limonada",
    zone: "Sarco",
    total: 76,
    status: "CONFIRMED",
  },
  {
    id: "5",
    number: 1243,
    customerName: "Lucía Pérez",
    itemsSummary: "Wings Clásicos · 6 piezas",
    zone: "Queru Queru",
    total: 42,
    status: "DELIVERED",
  },
];

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  NEW:               { label: "Nuevo",        tone: "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]" },
  PENDING_PAYMENT:   { label: "Esperando pago", tone: "bg-[color:var(--color-bark-100)] text-[color:var(--color-bark-700)]" },
  CONFIRMED:         { label: "Confirmado",   tone: "bg-[color:var(--color-leaf-500)]/14 text-[color:var(--color-leaf-600)]" },
  PREPARING:         { label: "Preparando",   tone: "bg-[#fde68a]/60 text-[#92400e]" },
  IN_DELIVERY:       { label: "En camino",    tone: "bg-[#dbeafe] text-[#1d4ed8]" },
  DELIVERED:         { label: "Entregado",    tone: "bg-[color:var(--color-bark-50)] text-[color:var(--color-bark-500)]" },
  CANCELLED:         { label: "Cancelado",    tone: "bg-[#fee2e2] text-[#991b1b]" },
};

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] shadow-soft">
      {/* topbar */}
      <div className="flex items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--bg)]/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-[color:var(--color-bark-50)] px-2 py-1 text-[11px] font-medium">
            Big Bite Wings <ChevronDown className="size-3 text-[color:var(--muted)]" />
          </div>
          <span className="hidden text-[11px] text-[color:var(--muted)] sm:inline">Hoy · 28 abr</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-[color:var(--line)] bg-[color:var(--card)] px-2 py-1 text-[11px] text-[color:var(--muted)] sm:inline-flex">
            <Search className="size-3" /> Buscar pedido
          </span>
          <button
            type="button"
            className="relative grid size-7 place-items-center rounded-md border border-[color:var(--line)] bg-[color:var(--card)]"
            aria-label="Notificaciones"
          >
            <Bell className="size-3.5" />
            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[color:var(--color-amber-500)] text-[9px] font-bold text-white">
              3
            </span>
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 divide-x divide-[color:var(--line)] border-b border-[color:var(--line)]">
        <Kpi label="Pedidos hoy" value="42" delta="+18%" />
        <Kpi label="Ticket prom." value="Bs 89" delta="+4%" />
        <Kpi label="Por confirmar" value="6" delta="urgente" tone="amber" />
      </div>

      {/* table */}
      <div className="divide-y divide-[color:var(--line)]">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
          <span>#</span>
          <span>Cliente</span>
          <span>Total</span>
          <span>Estado</span>
        </div>
        {PREVIEW_ORDERS.map((o) => {
          const s = STATUS_LABEL[o.status] ?? { label: o.status, tone: "" };
          return (
            <div
              key={o.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 transition hover:bg-[color:var(--color-cream-50)]"
            >
              <span className="font-mono text-[11px] text-[color:var(--muted)]">#{o.number}</span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{o.customerName}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[color:var(--muted)]">
                  <span className="truncate">{o.itemsSummary}</span>
                  {o.zone && (
                    <span className="hidden items-center gap-1 sm:inline-flex">
                      · <MapPin className="size-2.5" /> {o.zone}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums">Bs {o.total}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.tone}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  tone = "leaf",
}: {
  label: string;
  value: string;
  delta: string;
  tone?: "leaf" | "amber";
}) {
  const deltaClass =
    tone === "amber"
      ? "text-[color:var(--color-amber-600)]"
      : "text-[color:var(--color-leaf-600)]";
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-xl">{value}</span>
        <span className={`text-[10px] font-medium ${deltaClass}`}>{delta}</span>
      </div>
    </div>
  );
}
