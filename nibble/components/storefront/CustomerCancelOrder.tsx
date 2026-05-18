"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { customerCancelOrderAction } from "@/server/actions/order-management";
import type { ActionState } from "@/server/actions/store-settings";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState<"reason"> = {};

/**
 * Permite al cliente cancelar su propio pedido desde la página pública de
 * tracking. La autorización va por `trackingToken` (la página solo se
 * carga si el token coincide con un pedido válido).
 *
 * Visible SOLO para pedidos en estados cancelables por cliente
 * (PENDING_PAYMENT / NEW). Una vez confirmado/preparando, el cliente debe
 * coordinar por WhatsApp.
 *
 * Flujo: chip "Cancelar" → expande textarea de motivo → submit. Si la
 * action devuelve `ok`, la página entera revalida y muestra el estado
 * CANCELLED — el componente se desmonta.
 */
export function CustomerCancelOrder({ token }: { token: string }) {
  const [state, action] = useActionState(customerCancelOrderAction, initial);
  const [open, setOpen] = useState(false);

  if (state.ok) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-tomato-600)] hover:underline"
      >
        <X className="size-3.5" />
        Cancelar mi pedido
      </button>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 space-y-2 rounded-xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-3"
    >
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className="text-xs font-medium text-[color:var(--color-tomato-700)]">
          ¿Por qué cancelas? (lo verá el local)
        </span>
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={200}
          rows={2}
          placeholder="Cambié de idea / lo voy a pedir más tarde / etc."
          aria-invalid={Boolean(state.fieldErrors?.reason)}
          className="mt-1 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-tomato-500)]"
        />
        {state.fieldErrors?.reason && (
          <p role="alert" className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
            {state.fieldErrors.reason}
          </p>
        )}
      </label>
      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}
      <div className="flex items-center gap-2">
        <SubmitButton
          shape="pill"
          size="sm"
          pendingLabel="Cancelando…"
          className="bg-[color:var(--color-tomato-600)] hover:bg-[color:var(--color-tomato-700)]"
        >
          Confirmar cancelación
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          No, mejor no
        </button>
      </div>
    </form>
  );
}
