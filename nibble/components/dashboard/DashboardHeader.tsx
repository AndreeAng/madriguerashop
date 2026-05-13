import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Bell } from "lucide-react";

/**
 * Header sticky compartido del dashboard. Estaba duplicado en 7 pages — el
 * mismo bloque sticky con "Ver mi tienda" + Bell, con la única variación
 * de lo que cada page muestra a la izquierda (search forms, etc).
 *
 * `leftSlot` permite a cada page inyectar su search bar o controles propios.
 * `notificationDot` controla el punto rojo del bell sin acoplar al header
 * un fetch de notificaciones.
 */
export function DashboardHeader({
  storeSlug,
  leftSlot,
  notificationDot = false,
}: {
  storeSlug: string;
  leftSlot?: ReactNode;
  notificationDot?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-6">
        {leftSlot}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/${storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-medium hover:border-[color:var(--color-bark-300)]"
          >
            Ver mi tienda <ArrowUpRight className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label="Notificaciones (próximamente)"
            disabled
            className="relative inline-flex size-9 cursor-not-allowed items-center justify-center rounded-full border border-[color:var(--line)] opacity-70"
          >
            <Bell className="size-4" />
            {notificationDot && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[color:var(--color-amber-500)]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
