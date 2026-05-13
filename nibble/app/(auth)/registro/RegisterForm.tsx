"use client";

import { useActionState, useId, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Building2,
  Globe,
  Lock,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import { registerStoreAction, type RegisterStoreState } from "@/server/actions/onboarding";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { slugify } from "@/lib/validation/slug";
import { PhoneInputBO } from "@/components/shared/PhoneInputBO";

const initialState: RegisterStoreState = {};

// Verticales ofrecidos al cliente público. El server valida con
// `z.nativeEnum(StoreVertical)` (10 valores), pero acá excluimos OTHER
// porque es un comodín administrativo, no una elección genuina del owner.
// El seed tiene demo + template para los 9 expuestos.
const VERTICALS = [
  { value: "RESTAURANT", label: "Restaurante" },
  { value: "FOOD_TRUCK", label: "Food Truck" },
  { value: "BAKERY", label: "Panadería / Pastelería" },
  { value: "GROCERY", label: "Mercadito / Almacén" },
  { value: "RETAIL", label: "Retail / Moda" },
  { value: "HARDWARE", label: "Ferretería" },
  { value: "BEAUTY", label: "Estética / Belleza" },
  { value: "HEALTH", label: "Salud / Bienestar" },
  { value: "SERVICES", label: "Servicios" },
] as const;


export function RegisterForm() {
  const [state, formAction] = useActionState(registerStoreAction, initialState);

  // Slug auto-derivado del nombre, pero el owner puede sobreescribir.
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const slugId = useId();

  const effectiveSlug = slugTouched ? slug : slugify(storeName);

  return (
    <form action={formAction} className="mt-8 space-y-4" noValidate>
      {/* Honeypot anti-bot. El nombre `company_role` es deliberadamente
          neutro: password managers (que respetan tabIndex/aria-hidden) no
          lo autocompletan; bots que rellenan todos los inputs sí caen.
          Nombres demasiado obvios como `website_url` los detectan los bots
          modernos y los omiten. */}
      <input
        type="text"
        name="company_role"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {/* ============== TIENDA ============== */}
      <div className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Tu tienda
        </p>

        <Field
          name="storeName"
          label="Nombre de la tienda"
          icon={Building2}
          placeholder="Big Bite Wings"
          autoComplete="organization"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          error={state.fieldErrors?.storeName}
        />

        <label className="block">
          <span className="text-xs font-medium text-[color:var(--muted)]">
            Tu URL pública
          </span>
          <div className="relative mt-1.5">
            <Globe
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              id={slugId}
              name="slug"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="big-bite-wings"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              aria-invalid={Boolean(state.fieldErrors?.slug)}
              aria-describedby={state.fieldErrors?.slug ? `${slugId}-error` : `${slugId}-hint`}
              className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
            />
          </div>
          <p id={`${slugId}-hint`} className="mt-1.5 text-xs text-[color:var(--muted)]">
            Tu tienda se va a ver en{" "}
            <code className="rounded bg-[color:var(--bg)] px-1.5 py-0.5 font-mono text-[11px]">
              madrigueras.shop/{effectiveSlug || "tu-tienda"}
            </code>
          </p>
          {state.fieldErrors?.slug && (
            <p
              id={`${slugId}-error`}
              role="alert"
              className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
            >
              {state.fieldErrors.slug}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[color:var(--muted)]">Rubro</span>
          <select
            name="vertical"
            defaultValue=""
            aria-invalid={Boolean(state.fieldErrors?.vertical)}
            className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-3 text-sm outline-none focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
          >
            <option value="" disabled>
              Elegí tu rubro
            </option>
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.vertical && (
            <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
              {state.fieldErrors.vertical}
            </p>
          )}
        </label>

        <div>
          <PhoneInputBO
            label="WhatsApp de la tienda"
            name="whatsappPhone"
            error={state.fieldErrors?.whatsappPhone}
            required
          />
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Aquí te van a llegar los pedidos.
          </p>
        </div>

        <Field
          name="city"
          label="Ciudad"
          icon={MapPin}
          placeholder="Cochabamba"
          autoComplete="address-level2"
          error={state.fieldErrors?.city}
        />
      </div>

      {/* ============== OWNER ============== */}
      <div className="space-y-3 border-t border-[color:var(--line)] pt-5">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Tu cuenta
        </p>

        <Field
          name="ownerName"
          label="Tu nombre"
          icon={UserIcon}
          placeholder="Diego Antezana"
          autoComplete="name"
          error={state.fieldErrors?.ownerName}
        />

        <Field
          name="ownerIdentifier"
          label="Email o teléfono (con el que vas a entrar)"
          icon={AtSign}
          placeholder="diego@bigbite.bo"
          autoComplete="email"
          error={state.fieldErrors?.ownerIdentifier}
        />

        <Field
          name="password"
          label="Contraseña"
          icon={Lock}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hint="Mínimo 8 caracteres."
        />
      </div>

      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <label className="flex items-start gap-2 text-xs text-[color:var(--muted)]">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-0.5 size-4 rounded border-[color:var(--line-strong)]"
          aria-invalid={Boolean(state.fieldErrors?.acceptTerms)}
        />
        <span>
          Acepto los{" "}
          <a
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[color:var(--fg)]"
          >
            Términos del servicio
          </a>{" "}
          y la{" "}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[color:var(--fg)]"
          >
            Política de privacidad
          </a>{" "}
          de Madriguera Shop.
        </span>
      </label>
      {state.fieldErrors?.acceptTerms && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {state.fieldErrors.acceptTerms}
        </p>
      )}

      <SubmitButton
        width="full"
        className="mt-2 py-3"
        pendingLabel="Creando tu tienda…"
        icon={<ArrowRight className="size-4" aria-hidden="true" />}
      >
        Crear mi tienda
      </SubmitButton>

      <p className="text-[11px] text-[color:var(--muted)]">
        Sin tarjeta. Cancelas cuando quieras.
      </p>
    </form>
  );
}

// ============== Field helper ==============

type FieldProps = {
  name: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
};

function Field({
  name,
  label,
  icon: Icon,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  value,
  onChange,
  error,
  hint,
}: FieldProps) {
  const id = useId();
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <div className="relative mt-1.5">
        <Icon
          aria-hidden="true"
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]"
        />
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
        />
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[color:var(--muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
        >
          {error}
        </p>
      )}
    </label>
  );
}
