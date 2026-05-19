import type { ReactNode } from "react";
import { DeltaBadge } from "./DeltaBadge";

/**
 * Variante "spacious" del KPI card — pensada para pages de analytics donde
 * los cards son la pieza visual principal (admin/analytics, dashboard/analytics).
 *
 * Características:
 *   - `rounded-3xl` (más generoso que la versión compact)
 *   - Icon container `size-10` con color de fondo según `tone`
 *   - Label en `uppercase tracking-widest` arriba del valor (alta-densidad
 *     de info, label como "categoría" no como descripción)
 *   - Acepta `delta` opcional renderizado con `DeltaBadge`
 *
 * Para homes/dashboards simples (admin/home, dashboard/home), usar
 * `<KpiCardCompact>` que es visualmente menos protagonista.
 */

type Tone = "amber" | "leaf" | "sky" | "violet" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  amber: "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]",
  leaf: "bg-[color:var(--color-leaf-500)]/10 text-[color:var(--color-leaf-600)]",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  neutral: "bg-[color:var(--card-soft)] text-[color:var(--fg-soft)]",
};

export function KpiCard({
  icon,
  label,
  value,
  hint,
  delta,
  deltaFormat = "fraction",
  showNoComparable = false,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: ReactNode;
  /** Cambio relativo. Null/undefined → no se muestra badge a menos que
   *  `showNoComparable={true}`. */
  delta?: number | null;
  /** Formato del delta — ver `DeltaBadge`. Default "fraction" (0..1). */
  deltaFormat?: "fraction" | "percent";
  /** Si true, cuando delta es null muestra badge "sin comparable" en lugar
   *  de no renderear. Útil en analytics con primer periodo. */
  showNoComparable?: boolean;
  tone?: Tone;
}) {
  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex items-start justify-between">
        <div
          className={`grid size-10 place-items-center rounded-xl ${TONE_CLASSES[tone]}`}
        >
          {icon}
        </div>
        <DeltaBadge
          value={delta}
          format={deltaFormat}
          showNoComparable={showNoComparable}
        />
      </div>
      <p className="mt-4 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </p>
      <p className="font-display mt-1 text-2xl num-tabular">{value}</p>
      {hint && (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
    </div>
  );
}
