"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight, AtSign, Lock, Loader2 } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="press mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-bark-900)] px-5 py-3 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Entrando…
        </>
      ) : (
        <>
          Entrar
          <ArrowRight className="size-4" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

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

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-sm text-[color:var(--color-tomato-600)]"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
