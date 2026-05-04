import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Tags,
  Users,
  Map,
  Settings,
  BarChart3,
  CreditCard,
  ChevronsUpDown,
  Megaphone,
} from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";

const items = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/dashboard/pedidos", icon: ShoppingBag, label: "Pedidos", badge: 3 },
  { href: "#", icon: Package, label: "Productos" },
  { href: "#", icon: Tags, label: "Categorías" },
  { href: "#", icon: Megaphone, label: "Promociones" },
  { href: "#", icon: Users, label: "Clientes" },
  { href: "#", icon: Map, label: "Delivery" },
  { href: "#", icon: BarChart3, label: "Analytics" },
  { href: "#", icon: CreditCard, label: "Facturación" },
  { href: "#", icon: Settings, label: "Configuración" },
];

export function DashboardSidebar({ active = "/dashboard" }: { active?: string }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[color:var(--line)] bg-[color:var(--card)] md:flex md:flex-col">
      <div className="flex items-center gap-2 border-b border-[color:var(--line)] p-4">
        <button className="flex w-full items-center gap-3 rounded-xl bg-[color:var(--bg)] p-2.5 text-left transition hover:bg-[color:var(--line)]">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#dc2626] text-sm font-bold text-white">
            BB
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold leading-tight">Big Bite Wings</div>
            <div className="text-xs text-[color:var(--muted)]">nibble.bo/big-bite-wings</div>
          </div>
          <ChevronsUpDown className="size-3.5 text-[color:var(--muted)]" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = it.href === active;
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-[color:var(--color-bark-900)] text-white"
                  : "text-[color:var(--fg)] hover:bg-[color:var(--bg)]"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{it.label}</span>
              {it.badge && (
                <span className={`rounded-full px-1.5 text-[11px] font-semibold ${
                  isActive ? "bg-[color:var(--color-amber-500)] text-white" : "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-600)]"
                }`}>
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[color:var(--line)] p-3">
        <Link href="/" className="flex items-center justify-between rounded-lg p-2 text-xs text-[color:var(--muted)] hover:bg-[color:var(--bg)]">
          <span>Powered by</span>
          <NibbleLogo />
        </Link>
      </div>
    </aside>
  );
}
