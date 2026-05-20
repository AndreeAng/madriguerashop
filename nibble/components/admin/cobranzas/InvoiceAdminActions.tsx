"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, ShieldX, X } from "lucide-react";
import {
  verifyInvoicePaymentAction,
  cancelInvoiceAction,
} from "@/server/actions/invoices";
import type { ActionState } from "@/lib/validation/actionState";

function PendingButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "danger";
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "primary"
      ? "bg-[color:var(--color-leaf-600)] text-white hover:bg-[color:var(--color-leaf-700)]"
      : "border border-[color:var(--color-tomato-500)]/30 text-[color:var(--color-tomato-600)] hover:bg-[color:var(--color-tomato-500)]/10";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`press inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </button>
  );
}

export function InvoiceAdminActions({
  invoiceId,
  hasProof,
}: {
  invoiceId: string;
  hasProof: boolean;
}) {
  const [verifyState, verifyAction] = useActionState<ActionState, FormData>(
    verifyInvoicePaymentAction,
    {},
  );
  const [cancelState, cancelAction] = useActionState<
    ActionState<"reason">,
    FormData
  >(cancelInvoiceAction, {});
  const [showCancel, setShowCancel] = useState(false);

  const error = verifyState.error ?? cancelState.error;

  return (
    <div className="space-y-2">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-2.5 py-1.5 text-xs text-[color:var(--color-tomato-600)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form action={verifyAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <PendingButton>
            <CheckCircle2 className="size-3.5" />
            Marcar como pagada
          </PendingButton>
        </form>

        {!showCancel && (
          <button
            onClick={() => setShowCancel(true)}
            className="inline-flex items-center gap-1 text-xs text-[color:var(--muted)] hover:text-[color:var(--color-tomato-600)]"
          >
            <X className="size-3.5" />
            Cancelar factura
          </button>
        )}
      </div>

      {!hasProof && (
        <p className="text-[11px] text-[color:var(--muted)]">
          ⚠ Aún no subió comprobante. Verifica igual sólo si confirmaste el pago por otro medio.
        </p>
      )}

      {showCancel && (
        <form
          action={cancelAction}
          className="space-y-2 rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-2.5"
        >
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input
            name="reason"
            required
            minLength={3}
            maxLength={200}
            placeholder="Motivo (ej. duplicada, ajuste)"
            aria-invalid={Boolean(cancelState.fieldErrors?.reason)}
            className="w-full rounded-md border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-2 py-1 text-xs outline-none focus:border-[color:var(--color-tomato-500)]"
          />
          {cancelState.fieldErrors?.reason && (
            <p
              role="alert"
              className="text-[11px] text-[color:var(--color-tomato-600)]"
            >
              {cancelState.fieldErrors.reason}
            </p>
          )}
          <div className="flex items-center gap-2">
            <PendingButton variant="danger">
              <ShieldX className="size-3.5" />
              Cancelar factura
            </PendingButton>
            <button
              type="button"
              onClick={() => setShowCancel(false)}
              className="text-[11px] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            >
              Volver
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
