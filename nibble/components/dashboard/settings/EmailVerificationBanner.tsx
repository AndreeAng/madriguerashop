"use client";

import { useActionState, useEffect, useState } from "react";
import { MailCheck, MailWarning } from "lucide-react";
import { resendEmailVerificationAction } from "@/server/actions/store-settings";
import type { ActionState } from "@/lib/validation/actionState";

const INITIAL_STATE: ActionState = {};

export function EmailVerificationBanner({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    resendEmailVerificationAction,
    INITIAL_STATE,
  );
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if ("ok" in state && state.ok) setSent(true);
  }, [state]);

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="text-sm">
          <p className="font-medium text-emerald-800">Email de verificación enviado</p>
          <p className="mt-0.5 text-emerald-700">
            Revisa <span className="font-mono">{email}</span> y haz clic en el link para confirmar. El link es válido 24 hs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-600" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium text-amber-800">Email sin verificar</p>
          <p className="mt-0.5 text-amber-700">
            Confirma <span className="font-mono">{email}</span> para recibir notificaciones de pedidos y alertas de facturación.
          </p>
          {"error" in state && state.error && (
            <p className="mt-1 text-xs text-red-700">{state.error}</p>
          )}
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Reenviar link"}
          </button>
        </form>
      </div>
    </div>
  );
}
