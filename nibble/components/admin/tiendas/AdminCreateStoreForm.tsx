"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  adminCreateStoreAction,
  type AdminCreateStoreState,
} from "@/server/actions/admin-stores";
import { slugify } from "@/lib/validation/slug";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PhoneInputBO } from "@/components/shared/PhoneInputBO";

const initial: AdminCreateStoreState = {};

export function AdminCreateStoreForm({
  verticals,
  plans,
}: {
  verticals: { value: string; label: string }[];
  plans: { slug: string; name: string; monthlyPriceBob: string }[];
}) {
  const [state, action] = useActionState(adminCreateStoreAction, initial);
  const router = useRouter();

  // Slug auto-sugerido a partir del nombre. El usuario puede sobrescribirlo.
  const [storeName, setStoreName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugValue, setSlugValue] = useState("");
  const suggestedSlug = useMemo(() => slugify(storeName), [storeName]);
  const slug = slugTouched ? slugValue : suggestedSlug;

  // Post-éxito: la action devuelve `createdSlug` y navegamos client-side
  // al listado filtrado por ese slug (la action no expone el id).
  useEffect(() => {
    if (state.ok && state.createdSlug) {
      router.push(`/admin/tiendas?q=${state.createdSlug}`);
      router.refresh();
    }
  }, [state, router]);

  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8">
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-4 py-3 text-sm text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      {/* ============== Datos de la tienda ============== */}
      <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
        <h2 className="font-display text-lg">Datos de la tienda</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Lo mínimo para que aparezca y funcione. El owner puede editar todo
          después.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre"
            name="storeName"
            placeholder="Ej. Big Bite Wings"
            value={storeName}
            onChange={setStoreName}
            error={fe.storeName}
            required
          />
          <Field
            label="Identificador (URL)"
            name="slug"
            placeholder="big-bite-wings"
            prefix="madrigueras.shop/"
            value={slug}
            onChange={(v) => {
              setSlugTouched(true);
              setSlugValue(v);
            }}
            mono
            error={fe.slug}
            required
          />
          <SelectField
            label="Rubro"
            name="vertical"
            options={verticals}
            error={fe.vertical}
            required
          />
          <SelectField
            label="Plan"
            name="planSlug"
            options={plans.map((p) => ({
              value: p.slug,
              label: `${p.name} · ${p.monthlyPriceBob}/mes`,
            }))}
            error={fe.planSlug}
            required
          />
          {/* Mismo input con prefijo +591 fijo que usan checkout y registro
              — el admin solo tipea los 8 dígitos, sin formato que recordar. */}
          <PhoneInputBO
            label="WhatsApp"
            name="whatsappPhone"
            error={fe.whatsappPhone}
            required
          />
          <Field
            label="Ciudad"
            name="city"
            placeholder="Cochabamba"
            error={fe.city}
            required
          />
        </div>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPubliclyListed"
            className="size-4 rounded border-[color:var(--line-strong)]"
          />
          Listar públicamente en /tiendas
        </label>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Las demos para clientes potenciales conviene dejarlas SIN listar — el
          link viaja directo, pero no aparece en el directorio.
        </p>
      </section>

      {/* ============== Owner (opcional) ============== */}
      <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
        <h2 className="font-display text-lg">Owner (opcional)</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Llénalo si ya sabes quién será el dueño. Si lo dejas vacío, la
          tienda queda <strong>sin owner</strong> — perfecta para mostrar como
          demo. Después puedes asignar owner desde el detalle de la tienda.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre completo"
            name="ownerName"
            placeholder="Ej. Romina Tórrez"
            error={fe.ownerName}
          />
          <Field
            label="Email o teléfono"
            name="ownerIdentifier"
            placeholder="dueno@ejemplo.com o +591…"
            error={fe.ownerIdentifier}
          />
          <Field
            label="Contraseña inicial"
            name="ownerPassword"
            type="password"
            placeholder="Mínimo 8 caracteres"
            error={fe.ownerPassword}
            hint="El owner puede cambiarla después en su panel."
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/tiendas"
          className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </Link>
        <SubmitButton shape="pill" size="md" pendingLabel="Creando…">
          Crear tienda
        </SubmitButton>
      </div>
    </form>
  );
}

// ============== Sub-componentes ==============

function Field({
  label,
  name,
  type = "text",
  placeholder,
  prefix,
  value,
  onChange,
  error,
  required,
  hint,
  mono,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  prefix?: string;
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  required?: boolean;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label} {required && <span className="text-[color:var(--color-tomato-500)]">*</span>}
      </span>
      <div
        className={`mt-1 flex items-center rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 focus-within:border-[color:var(--color-amber-400)]`}
      >
        {prefix && (
          <span className="mr-1 select-none font-mono text-xs text-[color:var(--muted)]">
            {prefix}
          </span>
        )}
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`flex-1 bg-transparent text-sm outline-none ${
            mono ? "font-mono" : ""
          }`}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  error,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label} {required && <span className="text-[color:var(--color-tomato-500)]">*</span>}
      </span>
      <select
        name={name}
        defaultValue=""
        required={required}
        className={`mt-1 w-full rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
      >
        <option value="" disabled>
          Elige…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
