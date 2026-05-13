"use client";

import { useActionState } from "react";
import type { SaasSettings } from "@prisma/client";
import { updateSaasSettingsAction } from "@/server/actions/saas-settings";
import type { ActionState } from "@/server/actions/store-settings";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

export function SaasSettingsForm({ settings }: { settings: SaasSettings }) {
  const [state, action] = useActionState(updateSaasSettingsAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8">
      {state.ok && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
        >
          ✓ Configuración guardada. Los cambios se aplican en menos de 1 minuto.
        </p>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-sm text-[color:var(--color-tomato-600)]"
        >
          {state.error}
        </p>
      )}

      <Section title="Pagos del SaaS" description="QR e instrucciones que ven los owners al pagar su factura mensual.">
        <Field label="URL del QR estático" hint="Sube el QR a /api/upload o usa una URL externa." error={fe.paymentQrUrl}>
          <input
            name="paymentQrUrl"
            type="url"
            defaultValue={settings.paymentQrUrl ?? ""}
            placeholder="https://madrigueras.shop/uploads/qr.webp"
            className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </Field>
        <Field label="Instrucciones de pago" error={fe.paymentInstructions}>
          <textarea
            name="paymentInstructions"
            defaultValue={settings.paymentInstructions}
            rows={3}
            maxLength={1000}
            className="mt-1.5 w-full resize-none rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </Field>
      </Section>

      <Section title="Facturación" description="Cómo se numeran y cuándo se suspenden las tiendas que no pagan.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Prefijo de factura" hint="Ej. NIB- → NIB-000001" error={fe.billingInvoicePrefix}>
            <input
              name="billingInvoicePrefix"
              defaultValue={settings.billingInvoicePrefix}
              maxLength={8}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[color:var(--color-amber-400)]"
            />
          </Field>
          <Field label="Días hasta vencimiento" hint="Desde la emisión." error={fe.billingDueDays}>
            <input
              name="billingDueDays"
              type="number"
              min={0}
              max={60}
              defaultValue={settings.billingDueDays}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
          </Field>
          <Field label="Días de gracia" hint="Antes de suspender." error={fe.billingGraceDays}>
            <input
              name="billingGraceDays"
              type="number"
              min={0}
              max={30}
              defaultValue={settings.billingGraceDays}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
          </Field>
        </div>
      </Section>

      {/* La sección "Feature flags · roadmap V2" se removió porque exponía
          toggles decorativos: ningún server action consumía los flags
          (`featureDynamicQr`, `featureAiChatbot`, `featureMultiBranch`).
          Los campos siguen en el schema de Prisma para no romper la
          migración — cuando cada feature se implemente, se vuelve a agregar
          aquí con su toggle real. */}

      <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 shadow-soft">
        <SubmitButton />
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
      <h2 className="font-display text-lg">{title}</h2>
      {description && <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
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

