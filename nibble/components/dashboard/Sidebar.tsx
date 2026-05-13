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
  UserPlus,
  CalendarClock,
} from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";
import {
  AppSidebarShell,
  type SidebarItem,
} from "@/components/shared/AppSidebarShell";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { nameToInitials } from "@/lib/utils";

// Items que CASHIER puede ver. Los demás (productos, categorías, facturación,
// settings) son owner-only: el guard de cada page redirige, pero ocultarlos
// del sidebar evita que el cajero haga click y aparezca en home sin saber por qué.
const CASHIER_ALLOWED = new Set([
  "/dashboard",
  "/dashboard/pedidos",
  "/dashboard/reservas",
  "/dashboard/clientes",
]);

// Icons como JSX ya renderizado: Server Components no pueden pasar
// referencias de componentes a Client Components (sólo data serializable
// + elementos React ya construidos).
const ICON_CLS = "size-4";
const ALL_ITEMS: SidebarItem[] = [
  { href: "/dashboard", icon: <LayoutDashboard className={ICON_CLS} />, label: "Inicio" },
  { href: "/dashboard/pedidos", icon: <ShoppingBag className={ICON_CLS} />, label: "Pedidos" },
  { href: "/dashboard/reservas", icon: <CalendarClock className={ICON_CLS} />, label: "Reservas" },
  { href: "/dashboard/productos", icon: <Package className={ICON_CLS} />, label: "Productos" },
  { href: "/dashboard/categorias", icon: <Tags className={ICON_CLS} />, label: "Categorías" },
  { href: "/dashboard/promociones", icon: <Megaphone className={ICON_CLS} />, label: "Promociones" },
  { href: "/dashboard/clientes", icon: <Users className={ICON_CLS} />, label: "Clientes" },
  { href: "/dashboard/delivery", icon: <Map className={ICON_CLS} />, label: "Delivery" },
  { href: "/dashboard/analytics", icon: <BarChart3 className={ICON_CLS} />, label: "Analytics" },
  { href: "/dashboard/equipo", icon: <UserPlus className={ICON_CLS} />, label: "Equipo" },
  { href: "/dashboard/facturacion", icon: <CreditCard className={ICON_CLS} />, label: "Facturación" },
  { href: "/dashboard/settings", icon: <Settings className={ICON_CLS} />, label: "Configuración" },
];

export function DashboardSidebar({
  store,
  userRole,
}: {
  store?: {
    name: string;
    slug: string;
    primaryColor: string;
    logoUrl: string | null;
  };
  // Antes `userRole?: string` con default undefined → mostraba TODOS los items
  // si el caller olvidaba pasarlo, exponiendo navegación a CASHIER a páginas
  // que después rebotan en `requireOwnerOnly`. Lo hicimos required para que
  // el typechecker falle si un layout nuevo no lo provee.
  userRole: "STORE_OWNER" | "CASHIER" | "SUPER_ADMIN";
}) {
  const items =
    userRole === "CASHIER"
      ? ALL_ITEMS.filter((it) => CASHIER_ALLOWED.has(it.href))
      : ALL_ITEMS;
  const initials = nameToInitials(store?.name);

  return (
    <AppSidebarShell
      items={items}
      rootHref="/dashboard"
      header={
        <div className="flex items-center gap-2 border-b border-[color:var(--line)] p-4">
          <Link
            href={store ? `/${store.slug}` : "/dashboard"}
            target={store ? "_blank" : undefined}
            rel={store ? "noopener noreferrer" : undefined}
            className="flex w-full items-center gap-3 rounded-xl bg-[color:var(--bg)] p-2.5 text-left transition hover:bg-[color:var(--line)]"
          >
            <div
              className="flex size-9 items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-white"
              style={{ background: store?.primaryColor ?? "#1a1410" }}
            >
              {store?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">
                {store?.name ?? "Tu tienda"}
              </div>
              <div className="truncate text-xs text-[color:var(--muted)]">
                {store ? `madrigueras.shop/${store.slug}` : "madrigueras.shop"}
              </div>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-[color:var(--muted)]" />
          </Link>
        </div>
      }
      footer={
        <div className="space-y-2">
          <SignOutButton variant="light" />
          <Link
            href="/"
            className="flex items-center justify-between rounded-lg p-2 text-xs text-[color:var(--muted)] hover:bg-[color:var(--bg)]"
          >
            <span>Powered by</span>
            <NibbleLogo />
          </Link>
        </div>
      }
    />
  );
}
