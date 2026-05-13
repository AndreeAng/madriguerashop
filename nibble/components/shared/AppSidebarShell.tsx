"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type SidebarItem = {
  href: string;
  /**
   * Ícono ya renderizado como ReactNode (ej. `<LayoutDashboard className="size-4" />`).
   * Antes era `ComponentType` pero un Server Component no puede pasar
   * referencias a componentes a un Client Component — sólo elementos JSX
   * ya construidos. Renderizar el ícono en el caller también permite que
   * cada caller controle classNames sin que el shell sepa de lucide-react.
   */
  icon: ReactNode;
  label: string;
  badge?: number;
  comingSoon?: boolean;
};

/**
 * Shell visual común para el sidebar de admin y dashboard. La duplicación
 * antes era ~70%: ambos repetían el loop de items con la misma lógica de
 * `active` (matching por startsWith), el badge `comingSoon` y el badge
 * numérico. Lo único realmente distinto es:
 *   - El header (admin: logo + label; dashboard: store + slug + chevron).
 *   - El footer (admin: avatar admin; dashboard: "Powered by").
 *   - El tema (admin: dark; dashboard: light).
 *
 * Esos tres puntos los recibimos como props/slots, y el resto vive acá.
 */
export function AppSidebarShell({
  items,
  rootHref,
  header,
  footer,
  theme = "light",
}: {
  items: SidebarItem[];
  /** Href del primer item (matching exacto en activo). Default: items[0].href */
  rootHref?: string;
  header: ReactNode;
  footer?: ReactNode;
  theme?: "light" | "dark";
}) {
  const pathname = usePathname() ?? "";
  const root = rootHref ?? items[0]?.href ?? "/";

  const themeClasses =
    theme === "dark"
      ? "w-60 border-r border-[color:var(--line)] bg-[color:var(--color-bark-900)] text-white"
      : "w-64 border-r border-[color:var(--line)] bg-[color:var(--card)]";

  return (
    <aside className={`hidden shrink-0 md:flex md:flex-col ${themeClasses}`}>
      {header}

      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((it) => {
          const isActive =
            it.href === root ? pathname === root : pathname.startsWith(it.href);
          const activeClasses =
            theme === "dark"
              ? "bg-[color:var(--color-amber-500)] text-white"
              : "bg-[color:var(--color-bark-900)] text-white";
          const idleClasses =
            theme === "dark"
              ? "text-white/80 hover:bg-white/5"
              : "text-[color:var(--fg)] hover:bg-[color:var(--bg)]";
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? activeClasses : idleClasses
              }`}
            >
              <span className="grid size-4 shrink-0 place-items-center">
                {it.icon}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              {it.comingSoon && !isActive && (
                <span
                  className={`rounded-full px-1.5 text-[9px] font-medium uppercase tracking-wide ${
                    theme === "dark"
                      ? "bg-white/10 text-white/60"
                      : "bg-[color:var(--bg)] text-[color:var(--muted)]"
                  }`}
                >
                  Pronto
                </span>
              )}
              {it.badge !== undefined && it.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-semibold ${
                    isActive
                      ? theme === "dark"
                        ? "bg-white/15 text-white"
                        : "bg-[color:var(--color-amber-500)] text-white"
                      : theme === "dark"
                        ? "bg-white/10 text-white/80"
                        : "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-600)]"
                  }`}
                >
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {footer && (
        <div
          className={`border-t p-3 ${
            theme === "dark"
              ? "border-white/10"
              : "border-[color:var(--line)]"
          }`}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}

// `nameToInitials` ahora vive en `lib/utils.ts` para que sea importable
// desde server. NO re-exportamos desde acá: un re-export en un archivo
// `"use client"` re-marca el símbolo como client-only y Turbopack vuelve
// a bloquearlo cuando un Server Component lo llama.
