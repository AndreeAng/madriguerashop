/**
 * Alertas pill (rojo/verde) reutilizadas en forms server-action. El estilo
 * se duplicaba en 21 sitios con leves variantes — esto unifica.
 *
 * - `ErrorAlert`: tono tomato, `role="alert"`. Aparece sobre el form cuando
 *   la action devuelve `state.error`.
 * - `SuccessAlert`: tono verde, sin role (no es bloqueante). Confirmación.
 *
 * Si el alert se monta dinámicamente (state.error pasa de undefined a
 * string), el `role="alert"` hace que screen readers anuncien el cambio.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ErrorAlert({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-sm text-[color:var(--color-tomato-600)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SuccessAlert({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600",
        className,
      )}
    >
      {children}
    </p>
  );
}
