"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ErrorAlert } from "@/components/ui/Alert";

/**
 * Shell visual compartido por cada sección de settings.
 * Envuelve un <form> con título, descripción, contenido y bandeja de status.
 */
export function SectionShell({
  id,
  title,
  description,
  children,
  status,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  status?: ReactNode;
}) {
  return (
    <section id={id} className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6 md:p-8">
      <header className="mb-6">
        <h2 className="font-display text-2xl">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-[color:var(--muted)]">{description}</p>
        )}
      </header>
      <div className="space-y-4">{children}</div>
      {status && <div className="mt-5">{status}</div>}
    </section>
  );
}

/**
 * Status pill que muestra "Guardado" o el error general.
 *
 * El badge de éxito se auto-oculta a los 4 segundos — antes persistía
 * indefinidamente, dejando "✓ Cambios guardados" en pantalla hasta el
 * próximo submit. El usuario podía pensar que tenía cambios sin guardar.
 * Errores quedan visibles (requieren acción del usuario).
 */
export function StatusBadge({
  ok,
  error,
}: {
  ok?: true;
  error?: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Reset cuando cambia el estado (nuevo submit).
    setVisible(true);
    if (ok) {
      const t = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(t);
    }
  }, [ok, error]);

  if (error) {
    return <ErrorAlert>{error}</ErrorAlert>;
  }
  if (ok && visible) {
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 transition-opacity"
      >
        ✓ Cambios guardados
      </p>
    );
  }
  return null;
}

// (Hubo un `SaveButton` acá, duplicado de `components/ui/SubmitButton` que
// es el que usan todos los forms — eliminado.)

/** Input de texto reutilizable con error/hint y aria. */
export function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  error,
  hint,
  required,
  maxLength,
  inputMode,
  autoComplete,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}
        {required && <span className="ml-1 text-[color:var(--color-tomato-600)]">*</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
      />
      {hint && !error && (
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

/** Textarea reutilizable. */
export function TextArea({
  name,
  label,
  defaultValue,
  placeholder,
  error,
  hint,
  rows = 3,
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  error?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className="mt-1.5 w-full resize-y rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
      />
      {hint && !error && (
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

/** Toggle (checkbox visual) para booleanos. */
export function ToggleField({
  name,
  label,
  description,
  defaultChecked,
  error,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  error?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4 transition hover:bg-[color:var(--card)]">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 rounded border-[color:var(--line-strong)] accent-[color:var(--color-amber-500)]"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-[color:var(--muted)]">{description}</span>
        )}
        {error && (
          <span role="alert" className="mt-1 block text-xs text-[color:var(--color-tomato-600)]">
            {error}
          </span>
        )}
      </span>
    </label>
  );
}
