import Link from "next/link";

/**
 * Paginación prev/next con conteo "Página N de M · total items". Antes este
 * markup vivía duplicado en 5 admin pages (alertas, auditoria, tiendas,
 * cobranzas, usuarios), cada una construyendo su propio `buildPageHref`.
 *
 * El caller pasa `buildPageHref` para mantener los demás query params
 * (filter, q, etc) — la lib no sabe qué params quieres preservar.
 */
export function Pagination({
  page,
  totalPages,
  total,
  itemLabel,
  buildPageHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  /** Singular del item paginado, ej. "tienda" → "tiendas". */
  itemLabel: string;
  buildPageHref: (targetPage: number) => string;
}) {
  if (totalPages <= 1) return null;
  const plural = total === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex items-center justify-between text-sm"
    >
      <p className="text-[color:var(--muted)]">
        Página {page} de {totalPages} · {total} {plural}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={buildPageHref(page - 1)}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 hover:border-[color:var(--color-bark-300)]"
          >
            ← Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={buildPageHref(page + 1)}
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 hover:border-[color:var(--color-bark-300)]"
          >
            Siguiente →
          </Link>
        )}
      </div>
    </nav>
  );
}
