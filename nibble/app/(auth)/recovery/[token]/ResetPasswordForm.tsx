"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import {
  completePasswordResetAction,
  type CompleteResetState,
} from "@/server/actions/recovery";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: CompleteResetState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action] = useActionState(completePasswordResetAction, initial);

  useEffect(() => {
    if (state.ok) {
      const timer = setTimeout(() => router.push("/login"), 2500);
      return () => clearTimeout(timer);
    }
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[color:var(--color-leaf-500)]/30 bg-[color:var(--color-leaf-500)]/5 p-5 text-sm">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[color:var(--color-leaf-600)]" />
        <div>
          <p className="font-medium">Contraseña actualizada</p>
          <p className="mt-1 text-[color:var(--muted)]">
            Te llevamos al login en unos segundos…
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-3" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Nueva contraseña
        </span>
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </div>
        {state.fieldErrors?.password && (
          <p
            role="alert"
            className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
          >
            {state.fieldErrors.password}
          </p>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Repetir contraseña
        </span>
        <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
            className="w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] py-3 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </div>
        {state.fieldErrors?.confirmPassword && (
          <p
            role="alert"
            className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
          >
            {state.fieldErrors.confirmPassword}
          </p>
        )}
      </label>

      <SubmitButton
        width="full"
        className="mt-2 py-3"
        pendingLabel="Guardando…"
        icon={<ArrowRight className="size-4" />}
      >
        Cambiar contraseña
      </SubmitButton>
    </form>
  );
}
