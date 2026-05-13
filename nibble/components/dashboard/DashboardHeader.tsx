import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { LiveOrderBadge } from "./LiveOrderBadge";

/**
 * Header sticky compartido del dashboard. Estaba duplicado en 7 pages — el
 * mismo bloque sticky con "Ver mi tienda" + Bell, con la única variación
 * de lo que cada page muestra a la izquierda (search forms, etc).
 *
 * `leftSlot` permite a cada page inyectar su search bar o controles propios.
 * `notificationDot` (deprecated) ahora se reemplaza por `LiveOrderBadge`
 * que polea el endpoint `/api/dashboard/orders-meta` cada 30s — el caller
 * puede seguir pasando initial counts via SSR para que el badge tenga
 * estado correcto en el primer paint sin esperar el primer poll.
 */
export function DashboardHeader({
  storeSlug,
  leftSlot,
  initialActive = 0,
  initialAwaiting = 0,
}: {
  storeSlug: string;
  leftSlot?: ReactNode;
  /** Conteo inicial de pedidos activos (NEW/CONFIRMED/PREPARING/IN_DELIVERY). */
  initialActive?: number;
  /** Conteo inicial de pagos AWAITING_VERIFICATION. */
  initialAwaiting?: number;
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
          <LiveOrderBadge
            initialActive={initialActive}
            initialAwaiting={initialAwaiting}
          />
        </div>
      </div>
    </header>
  );
}
