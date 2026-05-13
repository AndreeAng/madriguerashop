import Link from "next/link";
import { AlertTriangle, TrendingUp } from "lucide-react";
import type { LimitStatus } from "@/lib/billing/plan-limits";

/**
 * Banner sticky en la home del dashboard cuando el owner se acerca o
 * supera un límite del plan. Toma los 3 status (products / staff /
 * orders) y agrupa en mensajes accionables.
 *
 * Reglas:
 *   - Exceeded → banner ROJO con "subir de plan" CTA. Acción urgente.
 *   - nearLimit (≥80%) → banner AMARILLO con "te queda poco". Acción no-urgente.
 *   - Ambos OK → no se renderiza el componente entero (parent decide).
 */
export function PlanLimitsBanner({
  products,
  staff,
  orders,
}: {
  products: LimitStatus | null;
  staff: LimitStatus | null;
  orders: LimitStatus | null;
}) {
  const exceeded: { label: string; current: number; limit: number }[] = [];
  const warnings: { label: string; current: number; limit: number }[] = [];

  const collect = (s: LimitStatus | null, label: string) => {
    if (!s || s.limit === null) return;
    if (s.exceeded) {
      exceeded.push({ label, current: s.current, limit: s.limit });
    } else if (s.nearLimit) {
      warnings.push({ label, current: s.current, limit: s.limit });
    }
  };
  collect(products, "productos activos");
  collect(staff, "cajeros");
  collect(orders, "pedidos este mes");

  if (exceeded.length === 0 && warnings.length === 0) return null;

  // Si hay alguno excedido, pintamos rojo (urgencia). Sino amarillo.
  const isUrgent = exceeded.length > 0;
  const items = isUrgent ? exceeded : warnings;

  return (
    <div
      className={`mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 ${
        isUrgent
          ? "border-[color:var(--color-tomato-500)]/40 bg-[color:var(--color-tomato-500)]/5"
          : "border-[color:var(--color-amber-500)]/40 bg-[color:var(--color-amber-50)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`mt-0.5 size-5 shrink-0 ${
            isUrgent
              ? "text-[color:var(--color-tomato-600)]"
              : "text-[color:var(--color-amber-600)]"
          }`}
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${
              isUrgent
                ? "text-[color:var(--color-tomato-700)]"
                : "text-[color:var(--color-amber-700)]"
            }`}
          >
            {isUrgent
              ? "Llegaste al tope de tu plan"
              : "Te estás acercando al tope de tu plan"}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-[color:var(--fg-soft)]">
            {items.map((it) => (
              <li key={it.label}>
                <span className="num-tabular">
                  {it.current}/{it.limit}
                </span>{" "}
                {it.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Link
        href="/dashboard/facturacion"
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium ${
          isUrgent
            ? "bg-[color:var(--color-tomato-600)] text-white hover:bg-[color:var(--color-tomato-700)]"
            : "bg-[color:var(--color-bark-900)] text-white hover:bg-[color:var(--color-bark-700)]"
        }`}
      >
        <TrendingUp className="size-3.5" />
        Ver mi plan
      </Link>
    </div>
  );
}
