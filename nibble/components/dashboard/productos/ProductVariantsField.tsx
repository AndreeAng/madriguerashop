"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * Variant tal como la pasa el caller (no incluye `_key`).
 */
type VariantInput = {
  id?: string;
  name: string;
  price: string; // string para edición; "" significa "usar precio base"
  sku?: string;
  /** Si esta variante maneja su propio stock (independiente del producto). */
  manageStock?: boolean;
  /** Stock disponible — sólo se considera si `manageStock` es true. */
  stock?: string;
};

/**
 * Variant con la key local. La key existe solo en runtime para que React
 * no recicle inputs al borrar una variante intermedia.
 */
type Variant = VariantInput & { _key: string };

function newLocalKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Field para administrar variantes simples (talla, sabor, tamaño).
 * Serializa a JSON en `name`.
 */
export function ProductVariantsField({
  name,
  initial,
  basePrice,
}: {
  name: string;
  initial?: VariantInput[];
  basePrice: string;
}) {
  const [variants, setVariants] = useState<Variant[]>(
    (initial ?? []).map((v) => ({ ...v, _key: v.id ?? newLocalKey() })),
  );

  function add() {
    setVariants((v) => [
      ...v,
      { _key: newLocalKey(), name: "", price: "", manageStock: false, stock: "0" },
    ]);
  }

  function update(i: number, patch: Partial<Variant>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function remove(i: number) {
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Variantes (opcional)
        </span>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--line)] px-2.5 py-1 text-xs hover:bg-[color:var(--bg)]"
        >
          <Plus className="size-3.5" /> Agregar variante
        </button>
      </div>

      {/* No queremos persistir `_key` (interno de UI) — lo strippeamos. */}
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          variants.map(({ _key, ...rest }) => {
            void _key;
            return rest;
          }),
        )}
        readOnly
      />

      {variants.length === 0 ? (
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Sin variantes. Útil para tallas, sabores, tamaños — y permite stock
          independiente por variante (ej. clavo 9mm con stock pero 11mm
          agotado).
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {variants.map((v, i) => (
            <div
              key={v._key}
              className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <input
                  placeholder="Nombre (ej. 12 piezas, 9mm, Combo)"
                  value={v.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
                />
                <input
                  placeholder={`Precio (vacío = ${basePrice || "base"})`}
                  inputMode="decimal"
                  value={v.price}
                  onChange={(e) => update(i, { price: e.target.value })}
                  className="rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
                />
                <input
                  placeholder="SKU (opcional)"
                  value={v.sku ?? ""}
                  onChange={(e) => update(i, { sku: e.target.value })}
                  className="rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-2.5 py-1.5 text-sm font-mono outline-none focus:border-[color:var(--color-amber-400)]"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Quitar variante"
                  className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
                >
                  <X className="size-4" />
                </button>
              </div>
              {/* Sección de stock por variante. Sólo aparece si está activo
                  el toggle; sin esto la fila se vuelve muy alta y mete ruido
                  para variantes sin stock-tracking (ej. tallas de ropa). */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted)]">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!v.manageStock}
                    onChange={(e) =>
                      update(i, { manageStock: e.target.checked })
                    }
                    className="size-3.5 rounded border-[color:var(--line-strong)]"
                  />
                  Controlar stock de esta variante
                </label>
                {v.manageStock && (
                  <label className="inline-flex items-center gap-1.5">
                    Stock:
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={v.stock ?? "0"}
                      onChange={(e) => update(i, { stock: e.target.value })}
                      className="w-20 rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-2 py-1 text-right text-sm num-tabular outline-none focus:border-[color:var(--color-amber-400)]"
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
