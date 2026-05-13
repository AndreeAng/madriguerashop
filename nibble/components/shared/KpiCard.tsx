import type { ComponentType, ReactNode } from "react";

/**
 * Tarjeta de KPI usada en dashboard home y admin (analytics, home).
 * Antes vivía duplicada como function local en cada page con ~5 props
 * casi idénticas. Centralizada acá para que cambios de tone/layout
 * apliquen a todos los KPIs de la app.
 *
 * Variante "lite" — sin delta — usada en admin home.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "neutral" | "amber" | "leaf" | "sky" | "violet";
}) {
  const toneClass = TONE_CLASSES[tone];
  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
        <span className={`grid size-7 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <p className="font-display mt-3 text-3xl leading-none num-tabular">{value}</p>
      {hint && (
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
    </div>
  );
}

const TONE_CLASSES: Record<NonNullable<Parameters<typeof KpiCard>[0]["tone"]>, string> = {
  neutral: "bg-[color:var(--bg)] text-[color:var(--fg-soft)]",
  amber: "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]",
  leaf: "bg-[color:var(--color-leaf-100)] text-[color:var(--color-leaf-700)]",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
};
