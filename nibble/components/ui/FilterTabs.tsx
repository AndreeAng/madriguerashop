import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Strip de tabs rounded-full estilo "All / Active / …" para filtros de
 * listas admin/dashboard. Antes este patrón vivía como `FilterChip` /
 * `TypeChip` / `StatusChip` local en 5+ pages.
 *
 * Cada item produce un `<Link>` (re-fetch del server component) en lugar
 * de un button con onClick — esto evita arrastrar "use client" al RSC y
 * mantiene la URL como source of truth del filtro activo.
 */
export type FilterTabItem = {
  key: string;
  label: string;
  href: string;
  count?: number;
};

export function FilterTabs({
  items,
  activeKey,
  className,
}: {
  items: FilterTabItem[];
  activeKey: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs transition",
              isActive
                ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                : "border-[color:var(--line)] bg-[color:var(--card)] text-[color:var(--fg-soft)] hover:border-[color:var(--color-bark-300)]",
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("ml-1.5 text-[10px]", isActive ? "opacity-80" : "opacity-60")}>
                ({item.count})
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
