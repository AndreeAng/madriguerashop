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
  DownloadCloud,
} from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";
import {
  AppSidebarShell,
  type SidebarItem,
} from "@/components/shared/AppSidebarShell";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { nameToInitials } from "@/lib/utils";

// Cada `icon` es JSX ya construido — los Server Components no pueden pasar
// referencias a componentes (LayoutDashboard) a un Client Component, sólo
// elementos serializables. Los iconos toman el tamaño del wrapper en el shell.
const ICON_CLS = "size-4";
const items: SidebarItem[] = [
  { href: "/admin", icon: <LayoutDashboard className={ICON_CLS} />, label: "Inicio" },
  { href: "/admin/tiendas", icon: <Store className={ICON_CLS} />, label: "Tiendas" },
  { href: "/admin/importar", icon: <DownloadCloud className={ICON_CLS} />, label: "Importar de Quick" },
  { href: "/admin/usuarios", icon: <Users className={ICON_CLS} />, label: "Usuarios" },
  { href: "/admin/cobranzas", icon: <CreditCard className={ICON_CLS} />, label: "Cobranzas" },
  { href: "/admin/plantillas", icon: <Layout className={ICON_CLS} />, label: "Plantillas" },
  { href: "/admin/analytics", icon: <BarChart3 className={ICON_CLS} />, label: "Analytics" },
  { href: "/admin/auditoria", icon: <ShieldCheck className={ICON_CLS} />, label: "Auditoría" },
  { href: "/admin/alertas", icon: <AlertCircle className={ICON_CLS} />, label: "Alertas" },
  { href: "/admin/settings", icon: <Settings className={ICON_CLS} />, label: "Configuración" },
];

export function AdminSidebar({
  user,
}: {
  user?: {
    fullName: string | null;
    email: string | null;
  };
}) {
  const initials = nameToInitials(user?.fullName);

  return (
    <AppSidebarShell
      items={items}
      rootHref="/admin"
      theme="dark"
      header={
        <div className="border-b border-white/10 p-5">
          <NibbleLogo className="text-white" mono />
          <p className="mt-1 text-[11px] uppercase tracking-widest text-white/50">
            Super Admin
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-[color:var(--color-amber-500)] text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold leading-tight">
                {user?.fullName ?? user?.email ?? "Admin"}
              </p>
              <p className="text-white/60">Super Admin</p>
            </div>
          </div>
          <SignOutButton variant="dark" />
        </div>
      }
    />
  );
}
