/**
 * Alerta pill de error reutilizada en forms server-action. El estilo se
 * duplicaba en 21 sitios con leves variantes — esto unifica.
 *
 * Tono tomato, `role="alert"`: aparece sobre el form cuando la action
 * devuelve `state.error`. Si el alert se monta dinámicamente (state.error
 * pasa de undefined a string), el `role="alert"` hace que screen readers
 * anuncien el cambio.
 *
 * (Hubo un `SuccessAlert` verde acá pero ninguna vista lo usaba — los forms
 * confirman éxito vía el estado del SubmitButton/StatusBadge.)
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
