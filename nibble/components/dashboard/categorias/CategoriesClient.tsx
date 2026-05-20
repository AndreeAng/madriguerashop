"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteCategoryAction,
  toggleCategoryVisibilityAction,
} from "@/server/actions/categories";
import { CategoryForm } from "./CategoryForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/Alert";
import { useDashboardCopy } from "@/lib/dashboard/copy-context";

type Cat = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  isVisible: boolean;
  productsCount: number;
  childrenCount: number;
};

type Mode = { type: "list" } | { type: "new" } | { type: "edit"; cat: Cat };

export function CategoriesClient({ categories }: { categories: Cat[] }) {
  // copy se lee en `RowInner` directamente (más cerca del uso).
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const parents = categories
    .filter((c) => !c.parentId)
    .map((c) => ({ id: c.id, name: c.name }));

  // Agrupar por padre
  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId);

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteCategoryAction(fd);
      if (res.error) setError(res.error);
    });
  }

  function handleToggle(c: Cat) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", c.id);
      fd.set("isVisible", String(c.isVisible));
      await toggleCategoryVisibilityAction(fd);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--muted)]">
          {categories.length} {categories.length === 1 ? "categoría" : "categorías"}
        </p>
        {mode.type === "list" && (
          <button
            onClick={() => setMode({ type: "new" })}
            className="press inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
          >
            <Plus className="size-4" />
            Nueva categoría
          </button>
        )}
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {(mode.type === "new" || mode.type === "edit") && (
        <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg">
              {mode.type === "new" ? "Nueva categoría" : `Editar: ${mode.cat.name}`}
            </h2>
            <button
              onClick={() => setMode({ type: "list" })}
              aria-label="Cerrar"
              className="grid size-8 place-items-center rounded-full hover:bg-[color:var(--bg)]"
            >
              <X className="size-4" />
            </button>
          </div>
          <CategoryForm
            category={mode.type === "edit" ? mode.cat : null}
            parents={parents}
            onDone={() => setMode({ type: "list" })}
          />
        </div>
      )}

      {mode.type === "list" && (
        <div className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
          {categories.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[color:var(--muted)]">
                Todavía no tienes categorías. Crea la primera para empezar a organizar tu menú.
              </p>
              <button
                onClick={() => setMode({ type: "new" })}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus className="size-4" />
                Crear categoría
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {tops.map((c) => (
                <CategoryRow
                  key={c.id}
                  cat={c}
                  pending={pending}
                  onEdit={() => setMode({ type: "edit", cat: c })}
                  onDelete={() => setPendingDelete({ id: c.id, name: c.name })}
                  onToggle={() => handleToggle(c)}
                  childrenList={childrenOf(c.id)}
                  onEditChild={(child) => setMode({ type: "edit", cat: child })}
                  onDeleteChild={(child) =>
                    setPendingDelete({ id: child.id, name: child.name })
                  }
                  onToggleChild={(child) => handleToggle(child)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar "${pendingDelete?.name}"?`}
        message="Esta acción es permanente. Las categorías con productos asociados no se pueden eliminar."
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

function CategoryRow({
  cat,
  pending,
  onEdit,
  onDelete,
  onToggle,
  childrenList,
  onEditChild,
  onDeleteChild,
  onToggleChild,
}: {
  cat: Cat;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  childrenList: Cat[];
  onEditChild: (c: Cat) => void;
  onDeleteChild: (c: Cat) => void;
  onToggleChild: (c: Cat) => void;
}) {
  return (
    <li>
      <RowInner cat={cat} pending={pending} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
      {childrenList.length > 0 && (
        <ul className="border-t border-[color:var(--line)] bg-[color:var(--bg)]">
          {childrenList.map((child) => (
            <li key={child.id} className="border-b border-[color:var(--line)] last:border-b-0">
              <RowInner
                cat={child}
                pending={pending}
                onEdit={() => onEditChild(child)}
                onDelete={() => onDeleteChild(child)}
                onToggle={() => onToggleChild(child)}
                isChild
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RowInner({
  cat,
  pending,
  onEdit,
  onDelete,
  onToggle,
  isChild,
}: {
  cat: Cat;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  isChild?: boolean;
}) {
  // Cuántos "productos/platos/servicios" hay en la categoría —
  // varía por vertical de la tienda.
  const copy = useDashboardCopy();
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 ${isChild ? "pl-12" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${cat.isVisible ? "" : "text-[color:var(--muted)] line-through"}`}>
            {cat.name}
          </span>
          {!cat.isVisible && (
            <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted)]">
              Oculta
            </span>
          )}
        </div>
        <p className="text-xs text-[color:var(--muted)]">
          <span className="font-mono">/{cat.slug}</span>
          {" · "}
          {cat.productsCount} {cat.productsCount === 1 ? copy.productSingular : copy.productsLabel.toLowerCase()}
          {cat.childrenCount > 0 && ` · ${cat.childrenCount} subcat.`}
        </p>
      </div>
      <button
        onClick={onToggle}
        disabled={pending}
        aria-label={cat.isVisible ? "Ocultar" : "Mostrar"}
        title={cat.isVisible ? "Ocultar del storefront" : "Mostrar en storefront"}
        className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)] disabled:opacity-40"
      >
        {cat.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      <button
        onClick={onEdit}
        aria-label="Editar"
        className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
      >
        <Pencil className="size-4" />
      </button>
      <button
        onClick={onDelete}
        disabled={pending}
        aria-label="Eliminar"
        className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)] disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
