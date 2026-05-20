"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { KeyRound, Pause, Play, Plus, UserCircle, X } from "lucide-react";
import {
  inviteCashierAction,
  resetCashierPasswordAction,
  toggleCashierAction,
  type InviteCashierState,
  type ResetCashierPasswordState,
} from "@/server/actions/cashier";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";

type Cashier = {
  id: string;
  fullName: string | null;
  contact: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const initialInvite: InviteCashierState = {};
const initialReset: ResetCashierPasswordState = {};

export function TeamClient({
  cashiers,
}: {
  cashiers: Cashier[];
}) {
  const [mode, setMode] = useState<"list" | "invite">("list");
  const [resetTarget, setResetTarget] = useState<Cashier | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Cashier | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(c: Cashier) {
    setToggleError(null);
    const fd = new FormData();
    fd.set("userId", c.id);
    fd.set("action", c.isActive ? "suspend" : "reactivate");
    startTransition(async () => {
      const res = await toggleCashierAction(fd);
      if (res.error) setToggleError(res.error);
    });
    setConfirmToggle(null);
  }

  if (mode === "invite") {
    return <InviteForm onDone={() => setMode("list")} />;
  }

  return (
    <div className="space-y-4">
      {toggleError && <ErrorAlert>{toggleError}</ErrorAlert>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--muted)]">
          {cashiers.length === 0
            ? "Sin cajeros invitados todavía."
            : `${cashiers.length} ${cashiers.length === 1 ? "cajero" : "cajeros"}`}
        </p>
        <button
          type="button"
          onClick={() => setMode("invite")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
        >
          <Plus className="size-4" />
          Invitar cajero
        </button>
      </div>

      {cashiers.length === 0 ? (
        <EmptyState
          icon={<UserCircle className="size-8" />}
          description="Sin cajeros invitados todavía. Cuando tengas más manos para atender pedidos, invitalos acá."
        />
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
          {cashiers.map((c) => (
            <li
              key={c.id}
              className={`flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] p-4 last:border-b-0 ${
                c.isActive ? "" : "bg-[color:var(--bg)] opacity-70"
              }`}
            >
              <UserCircle className="size-9 shrink-0 text-[color:var(--muted)]" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {c.fullName ?? "(sin nombre)"}
                  {!c.isActive && (
                    <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                      Suspendido
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-[color:var(--muted)]">
                  {c.contact}
                  {c.lastLoginAt ? (
                    <>
                      {" · último ingreso "}
                      <RelativeTime iso={c.lastLoginAt} />
                    </>
                  ) : (
                    " · nunca ingresó"
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(c)}
                title="Resetear contraseña"
                className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
              >
                <KeyRound className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmToggle(c)}
                title={c.isActive ? "Suspender" : "Reactivar"}
                className={`grid size-9 place-items-center rounded-lg transition ${
                  c.isActive
                    ? "text-[color:var(--muted)] hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
                    : "text-[color:var(--color-leaf-600)] hover:bg-[color:var(--color-leaf-500)]/10"
                }`}
              >
                {c.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[color:var(--muted)]">
        Cuando suspendés un cajero pierde acceso inmediatamente. Si vuelves
        a reactivarlo, mantiene su misma contraseña — no hace falta crear
        de cero.
      </p>

      {/* Modal reset password */}
      {resetTarget && (
        <ResetPasswordDialog
          cashier={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}

      {/* Confirm suspender/reactivar */}
      <ConfirmDialog
        open={confirmToggle !== null}
        title={
          confirmToggle?.isActive
            ? `¿Suspender a "${confirmToggle.fullName}"?`
            : `¿Reactivar a "${confirmToggle?.fullName}"?`
        }
        message={
          confirmToggle?.isActive
            ? "Va a perder acceso al panel inmediatamente. Sus sesiones activas mueren en menos de 5 minutos."
            : "Va a poder volver a entrar con su misma contraseña."
        }
        confirmLabel={confirmToggle?.isActive ? "Suspender" : "Reactivar"}
        destructive={!!confirmToggle?.isActive}
        onConfirm={() => confirmToggle && handleToggle(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}

// ============== Form de invitación ==============

function InviteForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(inviteCashierAction, initialInvite);
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="space-y-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Invitar cajero</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="Cerrar"
          className="grid size-8 place-items-center rounded-full hover:bg-[color:var(--bg)]"
        >
          <X className="size-4" />
        </button>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      <p className="text-xs text-[color:var(--muted)]">
        Crea una cuenta con la contraseña que tú elijas. Después compártela
        con el cajero (WhatsApp, presencial). Él puede cambiarla luego.
      </p>

      <Field
        label="Nombre completo"
        name="name"
        placeholder="Ej. Romina Tórrez"
        error={fe.name}
        required
      />
      <Field
        label="Email o teléfono"
        name="identifier"
        placeholder="cajero@ejemplo.com o +591…"
        error={fe.identifier}
        required
      />
      <Field
        label="Contraseña inicial"
        name="password"
        type="password"
        placeholder="Mínimo 8 caracteres"
        error={fe.password}
        required
      />

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-4 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </button>
        <SubmitButton shape="pill" size="sm">Invitar</SubmitButton>
      </div>
    </form>
  );
}

// ============== Modal reset password ==============

function ResetPasswordDialog({
  cashier,
  onClose,
}: {
  cashier: Cashier;
  onClose: () => void;
}) {
  const [state, action] = useActionState(resetCashierPasswordAction, initialReset);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-2xl"
      >
        <input type="hidden" name="userId" value={cashier.id} />
        <h2 className="font-display text-lg">Resetear contraseña</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Le enviamos un link de reseteo por email a{" "}
          <strong className="text-[color:var(--fg)]">{cashier.fullName}</strong>.
          El cajero define su nueva contraseña — tú no la ves.
        </p>

        {state.ok && (
          <p className="mt-3 rounded-lg bg-[color:var(--color-leaf-50)] px-3 py-2 text-xs text-[color:var(--color-leaf-700)]">
            ✓ Link enviado. Avisa al cajero que revise su email (válido 1 hora).
          </p>
        )}
        {state.error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-[color:var(--color-tomato-50)] px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
          >
            {state.error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            {state.ok ? "Cerrar" : "Cancelar"}
          </button>
          {!state.ok && (
            <SubmitButton shape="pill" size="sm" pendingLabel="Enviando…">
              Enviar link
            </SubmitButton>
          )}
        </div>
      </form>
    </div>
  );
}


// ============== Helpers ==============

function Field({
  label,
  name,
  type = "text",
  placeholder,
  error,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}{" "}
        {required && (
          <span className="text-[color:var(--color-tomato-500)]">*</span>
        )}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
      />
      {error && (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

/**
 * Renderiza el tiempo relativo solo en cliente (post-mount). En SSR
 * muestra "" para que el HTML server-rendered coincida con el primer
 * render del browser — sin mismatch de hydration. El texto aparece
 * después por hydration.
 */
function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    setText(formatRelative(iso));
  }, [iso]);
  return <span suppressHydrationWarning>{text}</span>;
}

/** "hace 2 horas" / "ayer" / "hace 3 días" — determinista, sin locale. */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "ayer";
  if (diffDay < 30) return `hace ${diffDay} días`;
  return date.toISOString().slice(0, 10);
}
