"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, AtSign, Lock } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-3" noValidate>
      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Email o teléfono
        </span>
        <div className="relative mt-1.5">
          <AtSign
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            name="username"
            type="text"
            inputMode="email"
            autoComplete="username"
            placeholder="diego@bigbite.bo"
            aria-invalid={Boolean(state.fieldErrors?.username)}
            aria-describedby={state.fieldErrors?.username ? "username-error" : undefined}
            className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
          />
        </div>
        {state.fieldErrors?.username && (
          <p id="username-error" role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
            {state.fieldErrors.username}
          </p>
        )}
      </label>

      <label className="block">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[color:var(--muted)]">Contraseña</span>
          <Link
            href="/recovery"
            className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            Olvidé mi contraseña
          </Link>
        </div>
        <div className="relative mt-1.5">
          <Lock
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[color:var(--color-amber-400)] focus:ring-2 focus:ring-[color:var(--color-amber-200)]/40"
          />
        </div>
        {state.fieldErrors?.password && (
          <p id="password-error" role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
            {state.fieldErrors.password}
          </p>
        )}
      </label>

      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <SubmitButton
        width="full"
        size="md"
        className="mt-2 py-3"
        pendingLabel="Entrando…"
        icon={<ArrowRight className="size-4" aria-hidden="true" />}
      >
        Entrar
      </SubmitButton>
    </form>
  );
}
