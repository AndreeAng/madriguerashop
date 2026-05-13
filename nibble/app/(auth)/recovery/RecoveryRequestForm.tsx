"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, AtSign, CheckCircle2 } from "lucide-react";
import {
  requestPasswordResetAction,
  type RequestResetState,
} from "@/server/actions/recovery";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: RequestResetState = {};

export function RecoveryRequestForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initial);

  if (state.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-[color:var(--color-leaf-500)]/30 bg-[color:var(--color-leaf-500)]/5 p-5 text-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[color:var(--color-leaf-600)]" />
          <div>
            {state.noticeKey === "no_email" ? (
              <>
                <p className="font-medium">
                  Tu cuenta usa teléfono, no email.
                </p>
                <p className="mt-1 text-[color:var(--muted)]">
                  No podemos enviar un link por SMS todavía. Escribinos al
                  WhatsApp de soporte y te ayudamos a recuperarla.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Revisá tu casilla.</p>
                <p className="mt-1 text-[color:var(--muted)]">
                  Si encontramos una cuenta con ese email, te enviamos un link
                  para restablecer la contraseña. El link es válido por 1 hora.
                </p>
              </>
            )}
          </div>
        </div>

        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          ← Volver al login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-3" noValidate>
      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Email o teléfono
        </span>
        <div className="relative mt-1.5">
          <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            name="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="diego@bigbite.bo"
            aria-invalid={Boolean(state.fieldErrors?.identifier)}
            className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </div>
        {state.fieldErrors?.identifier && (
          <p
            role="alert"
            className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
          >
            {state.fieldErrors.identifier}
          </p>
        )}
      </label>

      <SubmitButton
        width="full"
        className="mt-2 py-3"
        pendingLabel="Enviando…"
        icon={<ArrowRight className="size-4" />}
      >
        Enviar link de recuperación
      </SubmitButton>

      <p className="mt-4 text-center text-xs text-[color:var(--muted)]">
        ¿Recordaste la contraseña?{" "}
        <Link href="/login" className="font-medium text-[color:var(--fg)] hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
