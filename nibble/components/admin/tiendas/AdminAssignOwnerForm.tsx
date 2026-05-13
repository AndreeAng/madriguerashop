"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  adminAssignOwnerAction,
  adminTransferOwnerAction,
  type AdminAssignOwnerState,
} from "@/server/actions/admin-stores";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: AdminAssignOwnerState = {};

/**
 * Form de owner para una tienda. Mismo shape de inputs, distinto action:
 *  - `assign`: la tienda no tiene owner → crea uno nuevo.
 *  - `transfer`: la tienda ya tiene owner → suspende el viejo y crea el
 *    nuevo en una transacción.
 *
 * El caller (page del detalle) decide cuál `mode` pasar según
 * `hasActiveOwner`.
 */
export function AdminAssignOwnerForm({
  storeId,
  mode = "assign",
}: {
  storeId: string;
  mode?: "assign" | "transfer";
}) {
  const [state, action] = useActionState(
    mode === "transfer" ? adminTransferOwnerAction : adminAssignOwnerAction,
    initial,
  );
  const router = useRouter();
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="storeId" value={storeId} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <FieldGroup label="Nombre completo" error={fe.ownerName}>
          <input
            name="ownerName"
            placeholder="Romina Tórrez"
            className="w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </FieldGroup>
        <FieldGroup label="Email o teléfono" error={fe.ownerIdentifier}>
          <input
            name="ownerIdentifier"
            placeholder="dueno@ejemplo.com"
            className="w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </FieldGroup>
        <FieldGroup label="Contraseña inicial" error={fe.ownerPassword}>
          <input
            name="ownerPassword"
            type="password"
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </FieldGroup>
      </div>

      <div className="flex justify-end">
        <SubmitButton
          shape="pill"
          pendingLabel={mode === "transfer" ? "Transfiriendo…" : "Asignando…"}
        >
          {mode === "transfer" ? "Transferir tienda" : "Asignar owner"}
        </SubmitButton>
      </div>
    </form>
  );
}

function FieldGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
