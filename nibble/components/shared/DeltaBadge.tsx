import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/**
 * Badge de cambio porcentual con color + flecha. Verde si >0, rojo si <0,
 * gris/oculto si 0 o null/undefined.
 *
 * Cada caller pasa el delta en su formato y declara `format`:
 *   - `"percent"` (default): el valor YA está en porcentaje (23 → 23%)
 *   - `"fraction"`: el valor es fracción 0..1 (0.23 → 23.0%)
 *
 * Tener este toggle evita que los callers tengan que multiplicar por 100
 * (o dividir) antes de pasar — convención mixta venía de los helpers
 * `pctChange()` (integer-percent) y `pctDelta()` (fraction).
 *
 * Para analytics donde un null significa "no hay periodo previo para
 * comparar", usar `showNoComparable` para mostrar un badge "sin comparable"
 * en lugar de ocultar el componente (que dejaría un hueco en la grilla).
 */
export function DeltaBadge({
  value,
  format = "percent",
  hideZero = true,
  showNoComparable = false,
}: {
  value: number | null | undefined;
  format?: "fraction" | "percent";
  /** Si true (default), no renderea badge cuando value === 0. */
  hideZero?: boolean;
  /** Si true, cuando value es null/undefined renderea "sin comparable".
   *  Si false (default), no renderea nada. */
  showNoComparable?: boolean;
}) {
  if (value === null || value === undefined) {
    if (!showNoComparable) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[11px] text-[color:var(--muted)]">
        <Minus className="size-3" /> sin comparable
      </span>
    );
  }

  const pct = format === "fraction" ? value * 100 : value;
  const rounded = Math.round(pct * 10) / 10;

  if (rounded === 0) {
    if (hideZero) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[11px] text-[color:var(--muted)]">
        <Minus className="size-3" /> 0%
      </span>
    );
  }

  const positive = rounded > 0;
  const ArrowIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      <ArrowIcon className="size-3" />
      {Math.abs(rounded).toFixed(format === "fraction" ? 1 : 0)}%
    </span>
  );
}
