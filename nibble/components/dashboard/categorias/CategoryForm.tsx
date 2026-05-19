"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category } from "@prisma/client";
import { upsertCategoryAction } from "@/server/actions/categories";
import type { ActionState } from "@/lib/validation/actionState";
import { slugify } from "@/lib/validation/slug";
import {
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/dashboard/settings/SectionShell";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

type SerializableCategory = Pick<
  Category,
  "id" | "name" | "slug" | "description" | "parentId" | "imageUrl"
>;

export function CategoryForm({
  category,
  parents,
  onDone,
}: {
  category?: SerializableCategory | null;
  parents: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const [state, action] = useActionState(upsertCategoryAction, initial);
  const fe = state.fieldErrors ?? {};

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category?.slug));

  // Auto-derivar slug del nombre cuando no fue tocado
  const effectiveSlug = slugTouched ? slug : slugify(name);

  // Guard contra doble cierre si state.ok ya fue manejado.
  const doneRef = useRef(false);
  useEffect(() => {
    if (state.ok && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [state.ok, onDone]);

  return (
    <form action={action} noValidate className="space-y-4">
      {category?.id && <input type="hidden" name="id" value={category.id} />}

      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Nombre <span className="ml-1 text-[color:var(--color-tomato-600)]">*</span>
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wings"
          maxLength={60}
          aria-invalid={Boolean(fe.name)}
          className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
        />
        {fe.name && (
          <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
            {fe.name}
          </p>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">Slug</span>
        <input
          name="slug"
          type="text"
          autoComplete="off"
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          aria-invalid={Boolean(fe.slug)}
          className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
        />
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">
          Aparece en la URL: <code className="font-mono">tutienda/{effectiveSlug || "wings"}</code>
        </p>
        {fe.slug && (
          <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
            {fe.slug}
          </p>
        )}
      </label>

      <TextArea
        name="description"
        label="Descripción (opcional)"
        defaultValue={category?.description}
        rows={2}
        maxLength={280}
        error={fe.description}
      />

      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Categoría padre (opcional)
        </span>
        <select
          name="parentId"
          defaultValue={category?.parentId ?? ""}
          className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
        >
          <option value="">— Sin categoría padre —</option>
          {parents
            .filter((p) => p.id !== category?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        {fe.parentId && (
          <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
            {fe.parentId}
          </p>
        )}
      </label>

      <TextInput
        name="imageUrl"
        label="Imagen (URL — subida próximamente)"
        defaultValue={category?.imageUrl}
        placeholder="https://…"
        error={fe.imageUrl}
      />

      <StatusBadge ok={state.ok} error={state.error} />

      <div className="flex items-center gap-2">
        <SubmitButton>{category?.id ? "Actualizar" : "Crear categoría"}</SubmitButton>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl border border-[color:var(--line)] px-4 py-2.5 text-sm hover:bg-[color:var(--bg)]"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
