"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import {
  deleteProductAction,
  toggleProductActiveAction,
} from "@/server/actions/products";
import { formatBob } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/Alert";
import { useDashboardCopy } from "@/lib/dashboard/copy-context";

type Row = {
  id: string;
  name: string;
  slug: string;
  basePrice: string; // Decimal serializado
  comparePrice: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  isActive: boolean;
  manageStock: boolean;
  stock: number;
  lowStockAlert: number | null;
};

export function ProductsTable({ rows }: { rows: Row[] }) {
  const copy = useDashboardCopy();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteProductAction(fd);
      if (res.error) setError(res.error);
    });
  }

  function handleToggle(row: Row) {
    setError(null);
    startTransition(async () => {
      // No mandamos isActive: la action hace read-then-write contra DB
      // para evitar el race "otro tab cambió el estado" (toggle desde valor
      // viejo daría flip incorrecto).
      const fd = new FormData();
      fd.set("id", row.id);
      const res = await toggleProductActiveAction(fd);
      if (res.error) setError(res.error);
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        className="border-solid"
        description={`Todavía no tienes ${copy.productsLabel.toLowerCase()}. Crea el primero para que aparezca en tu storefront.`}
        action={
          <Link
            href="/dashboard/productos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white"
          >
            + Crear {copy.productSingular}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--bg)] text-xs uppercase text-[color:var(--muted)]">
            <tr>
              <th scope="col" className="px-5 py-3 text-left font-medium">{copy.productSingular.charAt(0).toUpperCase() + copy.productSingular.slice(1)}</th>
              <th scope="col" className="hidden px-3 py-3 text-left font-medium md:table-cell">
                Categoría
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Precio</th>
              <th scope="col" className="hidden px-3 py-3 text-right font-medium md:table-cell">
                Stock
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--line)]">
            {rows.map((r) => {
              const lowStock =
                r.manageStock && r.lowStockAlert !== null && r.stock <= r.lowStockAlert;
              return (
                <tr
                  key={r.id}
                  className={`${r.isActive ? "" : "bg-[color:var(--bg)]/40 text-[color:var(--muted)]"}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[color:var(--bg)]">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] uppercase text-[color:var(--muted)]">
                            sin foto
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/productos/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.name}
                        </Link>
                        <p className="font-mono text-xs text-[color:var(--muted)]">
                          /p/{r.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 md:table-cell">
                    {r.categoryName ?? <span className="text-[color:var(--muted)]">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="num-tabular font-medium">
                      {formatBob(Number(r.basePrice))}
                    </span>
                    {r.comparePrice && (
                      <span className="ml-1.5 num-tabular text-xs text-[color:var(--muted)] line-through">
                        {formatBob(Number(r.comparePrice))}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-right md:table-cell">
                    {r.manageStock ? (
                      <span className={`num-tabular ${lowStock ? "text-[color:var(--color-tomato-600)] font-semibold" : ""}`}>
                        {r.stock}
                      </span>
                    ) : (
                      <span className="text-[color:var(--muted)]">∞</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggle(r)}
                        disabled={pending}
                        aria-label={r.isActive ? "Desactivar" : "Activar"}
                        title={r.isActive ? "Ocultar del storefront" : "Mostrar en storefront"}
                        className="grid size-8 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)] disabled:opacity-40"
                      >
                        {r.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                      <Link
                        href={`/dashboard/productos/${r.id}`}
                        aria-label="Editar"
                        className="grid size-8 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
                      >
                        <Pencil className="size-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ id: r.id, name: r.name })}
                        disabled={pending}
                        aria-label="Eliminar"
                        className="grid size-8 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)] disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar "${pendingDelete?.name}"?`}
        message="Esta acción es permanente. El producto desaparecerá del storefront pero el historial de pedidos lo conserva."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
