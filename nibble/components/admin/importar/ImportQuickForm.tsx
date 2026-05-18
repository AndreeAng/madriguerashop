"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import {
  adminImportQuickAction,
  type ImportQuickState,
} from "@/server/actions/admin-import-quick";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { slugify } from "@/lib/validation/slug";

const initial: ImportQuickState = {};

/**
 * Form de import de tienda Quick → Madriguera.
 *
 * El owner pega la URL del competidor, completa los datos de la tienda
 * destino y del dueño. La action descarga ~1-3 min según cantidad de
 * imágenes — el form muestra el spinner durante todo ese tiempo.
 *
 * Al completar exitosamente, mostramos resumen + CTA al detalle de la
 * tienda creada. NO auto-redirigimos porque el operador quiere ver los
 * warnings (imágenes que fallaron, categorías omitidas, etc).
 */
export function ImportQuickForm({
  verticals,
}: {
  verticals: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(adminImportQuickAction, initial);
  const fe = state.fieldErrors ?? {};

  // Auto-deriva el slug del Madriguera desde el `sourceUrl`:
  // pega `https://cat.quick.com.bo/leozma` → slug = `leozma`.
  const [sourceUrl, setSourceUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  useEffect(() => {
    if (slugTouched) return;
    const match = sourceUrl.match(/cat\.quick\.com\.bo\/([a-z0-9-]+)/i);
    if (match?.[1]) setSlug(slugify(match[1]));
  }, [sourceUrl, slugTouched]);

  // Después de un import exitoso, ofrecemos navegar al detalle. Lo hacemos
  // como CTA explícito para que el operador alcance a leer warnings.
  return (
    <form action={action} className="space-y-6">
      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      {state.ok && state.result && (
        <div className="rounded-2xl border border-[color:var(--color-leaf-500)]/30 bg-[color:var(--color-leaf-500)]/5 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-leaf-700)]">
            <CheckCircle2 className="size-4" />
            Tienda importada
          </div>
          <p className="mt-2 text-sm">
            <strong>{state.result.categoriesCreated}</strong> categorías ·{" "}
            <strong>{state.result.productsCreated}</strong> productos ·{" "}
            <strong>{state.result.imagesDownloaded}</strong> imágenes
          </p>
          {state.result.warnings.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-[color:var(--color-amber-700)] hover:underline">
                {state.result.warnings.length} warnings — ver detalle
              </summary>
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-[color:var(--bg)] p-2 font-mono text-[11px]">
                {state.result.warnings.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/${state.result.storeSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--bg)]"
            >
              Ver storefront <ExternalLink className="size-3" />
            </Link>
            <button
              type="button"
              onClick={() => router.push("/admin/tiendas")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              Ir a /admin/tiendas
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Origen (Quick.com.bo)
        </p>
        <Field
          name="sourceUrl"
          label="URL de la tienda en Quick"
          placeholder="https://cat.quick.com.bo/leozma"
          value={sourceUrl}
          onChange={setSourceUrl}
          error={fe.sourceSlug}
          required
        />
      </section>

      <section className="space-y-3 border-t border-[color:var(--line)] pt-6">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Tienda destino (Madriguera)
        </p>
        <Field
          name="storeName"
          label="Nombre de la tienda"
          placeholder="Leozma"
          error={fe.storeName}
          required
        />
        <Field
          name="slug"
          label="Slug (URL pública)"
          placeholder="leozma"
          value={slug}
          onChange={(v) => {
            setSlugTouched(true);
            setSlug(slugify(v));
          }}
          hint={`Aparecerá en madrigueras.shop/${slug || "tu-slug"}`}
          error={fe.slug}
          required
        />
        <SelectField
          name="vertical"
          label="Rubro"
          options={verticals}
          error={fe.vertical}
          required
        />
        <Field
          name="city"
          label="Ciudad"
          placeholder="Cochabamba"
          error={fe.city}
          required
        />
        <Field
          name="whatsappPhone"
          label="WhatsApp de la tienda"
          placeholder="+59176355469"
          error={fe.whatsappPhone}
          required
        />
      </section>

      <section className="space-y-3 border-t border-[color:var(--line)] pt-6">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Owner (le creamos la cuenta)
        </p>
        <Field
          name="ownerName"
          label="Nombre del owner"
          placeholder="Nombre y apellido"
          error={fe.ownerName}
          required
        />
        <Field
          name="ownerIdentifier"
          label="Email o teléfono del owner"
          placeholder="owner@correo.com o +591..."
          error={fe.ownerIdentifier}
          required
        />
        <Field
          name="ownerPassword"
          label="Contraseña temporal"
          type="password"
          placeholder="Mínimo 8 caracteres"
          hint="El owner la cambia en su primer login (recovery)."
          error={fe.ownerPassword}
          required
        />
      </section>

      <SubmitButton pendingLabel="Importando — puede tardar 1-3 minutos…">
        Importar tienda
      </SubmitButton>
    </form>
  );
}

// ============== Helpers ==============

function Field({
  name,
  label,
  type = "text",
  placeholder,
  hint,
  error,
  required,
  value,
  onChange,
}: {
  name: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        value={onChange ? value : undefined}
        defaultValue={onChange ? undefined : value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  error,
  required,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}
      </span>
      <select
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        defaultValue=""
        className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
      >
        <option value="" disabled>
          Seleccioná…
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
