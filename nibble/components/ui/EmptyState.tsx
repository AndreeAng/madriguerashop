import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card de estado vacío. Antes se duplicaba en 11+ pages con leves variaciones
 * (border-dashed, p-10, icon centrado). Caller pasa `icon` ya renderizado
 * (no una referencia al componente) para que se pueda usar desde RSC sin
 * arrastrar deps de lucide al bundle de cliente.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-[color:var(--line)] bg-[color:var(--card)] p-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto flex size-8 items-center justify-center text-[color:var(--muted)]">
          {icon}
        </div>
      )}
      {title && <p className="mt-3 text-sm font-medium">{title}</p>}
      {description && (
        <p className={cn("text-sm text-[color:var(--muted)]", title ? "mt-1" : "mt-3")}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
