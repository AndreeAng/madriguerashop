"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChefHat, Bike, Package, X, Loader2, CheckCircle2, ShieldX } from "lucide-react";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import {
  changeOrderStatusAction,
  verifyPaymentAction,
  rejectPaymentAction,
  markOrderRefundedAction,
} from "@/server/actions/order-management";
import { STATUS_FLOW } from "@/lib/orders/status";
import type { ActionState } from "@/lib/validation/actionState";

const TRANSITION_LABELS: Partial<Record<OrderStatus, { label: string; icon: typeof Check }>> = {
  CONFIRMED: { label: "Confirmar", icon: Check },
  PREPARING: { label: "En cocina", icon: ChefHat },
  IN_DELIVERY: { label: "En camino", icon: Bike },
  DELIVERED: { label: "Entregado", icon: Package },
  CANCELLED: { label: "Cancelar", icon: X },
};

function PendingButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "primary"
      ? "bg-[color:var(--color-bark-900)] text-white hover:bg-[color:var(--color-bark-700)]"
      : variant === "danger"
        ? "border border-[color:var(--color-tomato-500)]/30 text-[color:var(--color-tomato-600)] hover:bg-[color:var(--color-tomato-500)]/10"
        : "border border-[color:var(--line-strong)] text-[color:var(--fg)] hover:bg-[color:var(--bg)]";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`press inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

/**
 * Botón de transición de estado con su PROPIO `useActionState`. Antes
 * `StatusActions` tenía un solo `useActionState` compartido entre los 4
 * forms — si una transición fallaba, el error aparecía en TODOS los botones
 * y el spinner se mostraba en todos a la vez. Aislar el state por form
 * elimina la diafonía visual.
 */
function StatusTransitionForm({
  orderId,
  toStatus,
  label,
  icon: Icon,
}: {
  orderId: string;
  toStatus: OrderStatus;
  label: string;
  icon: typeof Check;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    changeOrderStatusAction,
    {},
  );
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="toStatus" value={toStatus} />
        <PendingButton>
          <Icon className="size-4" />
          {label}
        </PendingButton>
      </form>
      {state.error && (
        <p
          role="alert"
          className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
        >
          {state.error}
        </p>
      )}
    </div>
  );
}

function CancelOrderForm({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    changeOrderStatusAction,
    {},
  );
  return (
    <form
      action={action}
      className="mt-3 space-y-2 rounded-xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="toStatus" value="CANCELLED" />
      <label className="block">
        <span className="text-xs font-medium text-[color:var(--color-tomato-700)]">
          Motivo de la cancelación
        </span>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={200}
          placeholder="Stock agotado / cliente desistió / pago no llegó"
          className="mt-1 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-tomato-500)]"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-xs text-[color:var(--color-tomato-600)]">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <PendingButton variant="danger">
          <X className="size-4" />
          Cancelar pedido
        </PendingButton>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Volver
        </button>
      </div>
    </form>
  );
}

export function StatusActions({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const [showCancelForm, setShowCancelForm] = useState(false);

  const allowedTransitions = STATUS_FLOW[currentStatus] ?? [];
  if (allowedTransitions.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3 text-center text-xs text-[color:var(--muted)]">
        Pedido cerrado. No hay más cambios de estado.
      </div>
    );
  }

  const forwardTransitions = allowedTransitions.filter((s) => s !== "CANCELLED");
  const canCancel = allowedTransitions.includes("CANCELLED");

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {forwardTransitions.map((to) => {
          const meta = TRANSITION_LABELS[to];
          if (!meta) return null;
          return (
            <StatusTransitionForm
              key={to}
              orderId={orderId}
              toStatus={to}
              label={meta.label}
              icon={meta.icon}
            />
          );
        })}
      </div>

      {canCancel && !showCancelForm && (
        <button
          onClick={() => setShowCancelForm(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[color:var(--color-tomato-600)] hover:underline"
        >
          <X className="size-3.5" />
          Cancelar pedido
        </button>
      )}

      {canCancel && showCancelForm && (
        <CancelOrderForm orderId={orderId} onClose={() => setShowCancelForm(false)} />
      )}
    </div>
  );
}

export function PaymentActions({
  orderId,
  paymentStatus,
}: {
  orderId: string;
  paymentStatus: PaymentStatus;
}) {
  const [verifyState, verifyAction] = useActionState<ActionState, FormData>(
    verifyPaymentAction,
    {},
  );
  const [rejectState, rejectAction] = useActionState<
    ActionState<"reason">,
    FormData
  >(rejectPaymentAction, {});
  const [showReject, setShowReject] = useState(false);

  if (paymentStatus === "VERIFIED") {
    return <VerifiedWithRefundOption orderId={orderId} />;
  }

  if (paymentStatus === "REJECTED") {
    return (
      <div className="rounded-xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-3 text-sm text-[color:var(--color-tomato-700)]">
        <ShieldX className="mr-1.5 inline-block size-4" />
        Pago rechazado.
      </div>
    );
  }

  if (paymentStatus === "REFUNDED") {
    return (
      <div className="rounded-xl border border-[color:var(--color-amber-500)]/30 bg-[color:var(--color-amber-500)]/5 p-3 text-sm text-[color:var(--color-amber-700)]">
        <ShieldX className="mr-1.5 inline-block size-4" />
        Pago reembolsado.
      </div>
    );
  }

  return (
    <div>
      {(verifyState.error || rejectState.error) && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-sm text-[color:var(--color-tomato-600)]"
        >
          {verifyState.error ?? rejectState.error}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <form action={verifyAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <PendingButton>
            <CheckCircle2 className="size-4" />
            Verificar pago
          </PendingButton>
        </form>
        {!showReject && (
          <button
            onClick={() => setShowReject(true)}
            className="rounded-xl border border-[color:var(--color-tomato-500)]/30 px-4 py-2 text-sm font-medium text-[color:var(--color-tomato-600)] transition hover:bg-[color:var(--color-tomato-500)]/10"
          >
            Rechazar pago
          </button>
        )}
      </div>

      {showReject && (
        <form
          action={rejectAction}
          className="mt-3 space-y-2 rounded-xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <label className="block">
            <span className="text-xs font-medium text-[color:var(--color-tomato-700)]">
              Motivo del rechazo
            </span>
            <input
              name="reason"
              required
              minLength={3}
              maxLength={200}
              placeholder="Comprobante ilegible / monto no coincide"
              aria-invalid={Boolean(rejectState.fieldErrors?.reason)}
              className="mt-1 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-tomato-500)]"
            />
            {rejectState.fieldErrors?.reason && (
              <p
                role="alert"
                className="mt-1 text-xs text-[color:var(--color-tomato-600)]"
              >
                {rejectState.fieldErrors.reason}
              </p>
            )}
          </label>
          <div className="flex items-center gap-2">
            <PendingButton variant="danger">
              <ShieldX className="size-4" />
              Rechazar
            </PendingButton>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            >
              Volver
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Cuando el pago está VERIFIED, mostramos confirmación + opción de
 * registrar un reembolso. El reembolso real (devolución del dinero al
 * cliente) ocurre fuera de la app — esta UI solo registra el estado
 * contable para que dashboards de revenue excluyan estos pedidos.
 */
function VerifiedWithRefundOption({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<ActionState<"reason">, FormData>(
    markOrderRefundedAction,
    {},
  );
  const [showRefund, setShowRefund] = useState(false);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[color:var(--color-leaf-500)]/30 bg-[color:var(--color-leaf-500)]/5 p-3 text-sm text-[color:var(--color-leaf-700)]">
        <CheckCircle2 className="mr-1.5 inline-block size-4" />
        Pago verificado.
      </div>

      {!showRefund ? (
        <button
          type="button"
          onClick={() => setShowRefund(true)}
          className="text-xs text-[color:var(--muted)] underline hover:text-[color:var(--fg)]"
        >
          Marcar como reembolsado
        </button>
      ) : (
        <form
          action={action}
          className="space-y-2 rounded-xl border border-[color:var(--color-amber-500)]/30 bg-[color:var(--color-amber-500)]/5 p-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <p className="text-xs text-[color:var(--color-amber-800)]">
            Solo registra el reembolso en el sistema. La devolución del
            dinero la coordinas tú con el cliente.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-[color:var(--color-amber-800)]">
              Motivo del reembolso
            </span>
            <input
              name="reason"
              required
              minLength={3}
              maxLength={280}
              placeholder="Pedido cancelado por cliente / producto devuelto / verificación errónea"
              aria-invalid={Boolean(state.fieldErrors?.reason)}
              className="mt-1 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-500)]"
            />
            {state.fieldErrors?.reason && (
              <p
                role="alert"
                className="mt-1 text-xs text-[color:var(--color-tomato-600)]"
              >
                {state.fieldErrors.reason}
              </p>
            )}
          </label>
          {state.error && (
            <p role="alert" className="text-xs text-[color:var(--color-tomato-600)]">
              {state.error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <PendingButton variant="danger">
              <ShieldX className="size-4" />
              Confirmar reembolso
            </PendingButton>
            <button
              type="button"
              onClick={() => setShowRefund(false)}
              className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            >
              Volver
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

