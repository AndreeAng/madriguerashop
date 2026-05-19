"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MoreHorizontal, ShieldOff, ShieldCheck, Mail, RefreshCcw } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  suspendUserAction,
  reactivateUserAction,
  sendPasswordResetForUserAction,
  changeUserRoleAction,
} from "@/server/actions/admin-users";
import type { ActionState } from "@/lib/validation/actionState";
import { useDoneOnce } from "@/hooks/useDoneOnce";

const initial: ActionState = {};

export function UserActions({
  user,
  isSelf,
}: {
  user: {
    id: string;
    role: Role;
    isActive: boolean;
    hasEmail: boolean;
    hasStore: boolean;
  };
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // No exponemos acciones sobre uno mismo ni sobre otros super admins.
  if (isSelf || user.role === "SUPER_ADMIN") {
    return <span className="text-xs text-[color:var(--muted)]">—</span>;
  }
  if (user.role === "CUSTOMER") {
    // Customers no se gestionan acá (no tienen acceso al dashboard).
    return <span className="text-xs text-[color:var(--muted)]">—</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-lg border border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
        aria-label="Acciones"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            tabIndex={-1}
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] p-1 shadow-float">
            {feedback && (
              <p className="mb-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700">
                {feedback}
              </p>
            )}

            {user.isActive ? (
              <SuspendItem userId={user.id} onDone={(msg) => setFeedback(msg)} />
            ) : (
              <ReactivateItem userId={user.id} onDone={(msg) => setFeedback(msg)} />
            )}

            {user.hasEmail && user.isActive && (
              <ResetPasswordItem userId={user.id} onDone={(msg) => setFeedback(msg)} />
            )}

            {user.hasStore && (
              <ChangeRoleItem userId={user.id} currentRole={user.role} onDone={(msg) => setFeedback(msg)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SuspendItem({ userId, onDone }: { userId: string; onDone: (msg: string) => void }) {
  const [state, action] = useActionState(suspendUserAction, initial);
  useDoneOnce(state.ok, () => onDone("Usuario suspendido. Sesiones cerradas."));
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <ItemButton tone="danger" icon={<ShieldOff className="size-4" />} label="Suspender (cierra sesión)" />
      {state.error && (
        <p className="px-3 py-1 text-[11px] text-[color:var(--color-tomato-600)]">{state.error}</p>
      )}
    </form>
  );
}

function ReactivateItem({ userId, onDone }: { userId: string; onDone: (msg: string) => void }) {
  const [state, action] = useActionState(reactivateUserAction, initial);
  useDoneOnce(state.ok, () => onDone("Usuario reactivado."));
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <ItemButton tone="primary" icon={<ShieldCheck className="size-4" />} label="Reactivar" />
      {state.error && (
        <p className="px-3 py-1 text-[11px] text-[color:var(--color-tomato-600)]">{state.error}</p>
      )}
    </form>
  );
}

function ResetPasswordItem({ userId, onDone }: { userId: string; onDone: (msg: string) => void }) {
  const [state, action] = useActionState(sendPasswordResetForUserAction, initial);
  useDoneOnce(state.ok, () => onDone("Email de reset enviado. Expira en 1h."));
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <ItemButton icon={<Mail className="size-4" />} label="Enviar reset de password" />
      {state.error && (
        <p className="px-3 py-1 text-[11px] text-[color:var(--color-tomato-600)]">{state.error}</p>
      )}
    </form>
  );
}

function ChangeRoleItem({
  userId,
  currentRole,
  onDone,
}: {
  userId: string;
  currentRole: Role;
  onDone: (msg: string) => void;
}) {
  const toRole: "STORE_OWNER" | "CASHIER" =
    currentRole === "STORE_OWNER" ? "CASHIER" : "STORE_OWNER";
  const label =
    currentRole === "STORE_OWNER" ? "Bajar a Cajero" : "Promover a Dueño";

  const [state, action] = useActionState(changeUserRoleAction, initial);
  useDoneOnce(state.ok, () =>
    onDone(`Rol cambiado a ${toRole === "STORE_OWNER" ? "Dueño" : "Cajero"}.`),
  );
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="toRole" value={toRole} />
      <ItemButton icon={<RefreshCcw className="size-4" />} label={label} />
      {state.error && (
        <p className="px-3 py-1 text-[11px] text-[color:var(--color-tomato-600)]">{state.error}</p>
      )}
    </form>
  );
}

function ItemButton({
  icon,
  label,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "neutral" | "primary" | "danger";
}) {
  const { pending } = useFormStatus();
  const cls =
    tone === "danger"
      ? "text-[color:var(--color-tomato-600)] hover:bg-[color:var(--color-tomato-500)]/10"
      : tone === "primary"
        ? "text-[color:var(--color-leaf-600)] hover:bg-[color:var(--color-leaf-500)]/10"
        : "text-[color:var(--fg)] hover:bg-[color:var(--bg)]";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
