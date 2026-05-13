"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertTemplateAction } from "@/server/actions/admin-templates";
import type { ActionState } from "@/server/actions/store-settings";
import { ImageUploadField } from "@/components/dashboard/shared/ImageUploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";

const initial: ActionState = {};

const VERTICALS: { value: string; label: string }[] = [
  { value: "RESTAURANT", label: "Restaurante" },
  { value: "FOOD_TRUCK", label: "Food truck" },
  { value: "RETAIL", label: "Retail" },
  { value: "HARDWARE", label: "Ferretería" },
  { value: "SERVICES", label: "Servicios" },
];

type TemplateInput = {
  id: string;
  name: string;
  vertical: string;
  description: string;
  previewUrl: string;
  componentKey: string;
  sortOrder: number;
  isActive: boolean;
};

export function TemplateForm({
  template,
}: {
  template: TemplateInput | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState(upsertTemplateAction, initial);
  const fe = state.fieldErrors ?? {};

  const [previewUrl, setPreviewUrl] = useState(template?.previewUrl ?? "");

  const redirectedRef = useRef(false);
  useEffect(() => {
    if (state.ok && !redirectedRef.current && !template?.id) {
      redirectedRef.current = true;
      router.push("/admin/plantillas");
      router.refresh();
    }
  }, [state.ok, router, template?.id]);

  return (
    <form action={action} className="space-y-6">
      {template?.id && <input type="hidden" name="id" value={template.id} />}

      {state.ok && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
        >
          ✓ Plantilla guardada.
        </p>
      )}
      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <Section title="Identidad">
        <Field label="Nombre" required error={fe.name}>
          <input
            name="name"
            defaultValue={template?.name ?? ""}
            placeholder="Restaurante moderno"
            maxLength={60}
            className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </Field>
        <Field label="Vertical" required error={fe.vertical}>
          <select
            name="vertical"
            defaultValue={template?.vertical ?? "RESTAURANT"}
            className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          >
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción" required error={fe.description}>
          <textarea
            name="description"
            defaultValue={template?.description ?? ""}
            rows={3}
            maxLength={500}
            className="mt-1.5 w-full resize-none rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </Field>
      </Section>

      <Section title="Preview">
        {/* Subimos a /api/upload con kind=banner para que pase por sharp + WebP */}
        <ImageUploadField
          name="previewUrl"
          label="Imagen de preview"
          kind="banner"
          initialUrl={template?.previewUrl ?? null}
          aspect="wide"
          hint="Captura representativa de cómo se ve esta plantilla aplicada."
          error={fe.previewUrl}
          onChange={setPreviewUrl}
        />

        {previewUrl && (
          <div className="mt-2 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]">
            <p className="border-b border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[color:var(--muted)]">
              Vista previa
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="aspect-video w-full object-cover" />
          </div>
        )}
      </Section>

      <Section title="Render">
        <Field
          label="Component key"
          required
          hint="Identificador del componente React que renderiza esta plantilla. Crear uno nuevo requiere agregar el código correspondiente."
          error={fe.componentKey}
        >
          <input
            name="componentKey"
            defaultValue={template?.componentKey ?? ""}
            placeholder="restaurant_v1"
            maxLength={60}
            className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Orden" hint="Menor número aparece primero." error={fe.sortOrder}>
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={100}
              defaultValue={template?.sortOrder ?? 0}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] p-4 transition hover:bg-[color:var(--card)]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={template?.isActive ?? true}
              className="mt-0.5 size-4 rounded border-[color:var(--line-strong)] accent-[color:var(--color-amber-500)]"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium">Activa</span>
              <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                Si está inactiva, no se asigna a tiendas nuevas y aparece atenuada en la lista.
              </span>
            </span>
          </label>
        </div>
      </Section>

      <div className="sticky bottom-4 flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 shadow-soft">
        <button
          type="button"
          onClick={() => router.push("/admin/plantillas")}
          className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm hover:bg-[color:var(--bg)]"
        >
          Cancelar
        </button>
        <SubmitButton>
          {template?.id ? "Guardar cambios" : "Crear plantilla"}
        </SubmitButton>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
      <h2 className="font-display text-lg">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}
        {required && <span className="ml-1 text-[color:var(--color-tomato-600)]">*</span>}
      </span>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-[color:var(--muted)]">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
