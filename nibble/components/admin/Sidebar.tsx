import Link from "next/link";
import {
  LayoutDashboard,
  Store,
  Users,
  CreditCard,
  Layout,
  BarChart3,
  ShieldCheck,
  Settings,
  AlertCircle,
} from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";

const items = [
  { href: "/admin", icon: LayoutDashboard, label: "Inicio" },
  { href: "#", icon: Store, label: "Tiendas", badge: 138 },
  { href: "#", icon: Users, label: "Usuarios" },
  { href: "#", icon: CreditCard, label: "Facturación", badge: 4 },
  { href: "#", icon: Layout, label: "Plantillas" },
  { href: "#", icon: BarChart3, label: "Analytics" },
  { href: "#", icon: ShieldCheck, label: "Auditoría" },
  { href: "#", icon: AlertCircle, label: "Alertas" },
  { href: "#", icon: Settings, label: "Configuración" },
];

export function AdminSidebar({ active = "/admin" }: { active?: string }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[color:var(--line)] bg-[color:var(--color-bark-900)] text-white md:flex md:flex-col">
      <div className="border-b border-white/10 p-5">
        <NibbleLogo className="text-white" mono />
        <p className="mt-1 text-[11px] uppercase tracking-widest text-white/50">Super Admin</p>
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
                isActive ? "bg-[color:var(--color-amber-500)] text-white" : "text-white/80 hover:bg-white/5"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{it.label}</span>
              {it.badge && (
                <span className="rounded-full bg-white/10 px-1.5 text-[11px] font-semibold">
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-[color:var(--color-amber-500)] text-xs font-bold">
            EA
          </div>
          <div className="text-xs">
            <p className="font-semibold leading-tight">Eandree Angulo</p>
            <p className="text-white/60">Super Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
