import type { ComponentType } from "react";
import { DeltaBadge } from "./DeltaBadge";

/**
 * Variante "compact" del KPI card — pensada para pages-home donde los
 * cards son resumen rápido y no tienen que dominar visualmente
 * (admin/home, dashboard/home).
 *
 * Características vs `<KpiCard>`:
 *   - `rounded-2xl` (menos generoso)
 *   - Icon container `size-9` con color amber fijo (no `tone` configurable)
 *   - Label plain (sin uppercase tracking), porque es descripción no categoría
 *   - El icon va como `ComponentType` (lucide-style) y se renderea con `size-4`
 *     fijo — el caller no se preocupa por el tamaño
 */
export function KpiCardCompact({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  deltaFormat = "percent",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  /** Cambio relativo. Null/undefined → no se muestra badge. */
  delta?: number | null;
  /** Formato del delta — default "percent" (23 → 23%) para uso casual de
   *  homes. Analytics suelen pasar "fraction" (0.23). */
  deltaFormat?: "fraction" | "percent";
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[color:var(--bg)] text-[color:var(--color-amber-600)]">
          <Icon className="size-4" />
        </div>
        <DeltaBadge value={delta} format={deltaFormat} />
      </div>
      <div className="mt-4">
        <p className="text-xs text-[color:var(--muted)]">{label}</p>
        <p className="font-display mt-1 text-2xl num-tabular">{value}</p>
        {hint && (
          <p className="mt-1 text-[11px] text-[color:var(--muted)]">{hint}</p>
        )}
      </div>
    </div>
  );
}
