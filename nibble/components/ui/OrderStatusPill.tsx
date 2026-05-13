import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/orders/status";

/**
 * Pill compacto de estado de pedido. Antes este markup se duplicaba en 5
 * pages distintas (dashboard, pedidos lista, pedidos detalle, clientes
 * detalle, tracking page). El render acoplado a `STATUS_COLORS`/`STATUS_LABELS`
 * garantiza que un nuevo OrderStatus en el enum agregue label/color en un
 * solo lugar.
 */
export function OrderStatusPill({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.bg,
        c.fg,
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
