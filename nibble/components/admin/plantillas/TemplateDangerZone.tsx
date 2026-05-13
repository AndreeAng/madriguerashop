"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, ArrowRightLeft } from "lucide-react";
import {
  deleteTemplateAction,
  reassignStoresToTemplateAction,
} from "@/server/actions/admin-templates";
import type { ActionState } from "@/server/actions/store-settings";
import { useDoneOnce } from "@/hooks/useDoneOnce";

const initial: ActionState = {};

export function TemplateDangerZone({
  templateId,
  templateName,
  storesUsing,
  otherTemplates,
}: {
  templateId: string;
  templateName: string;
  storesUsing: number;
  otherTemplates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className="rounded-3xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-6">
      <h2 className="font-display text-lg text-[color:var(--color-tomato-700)]">Zona peligrosa</h2>

      {storesUsing > 0 && otherTemplates.length > 0 && (
        <ReassignBlock
          fromTemplateId={templateId}
          storesUsing={storesUsing}
          otherTemplates={otherTemplates}
        />
      )}

      <div className="mt-6 border-t border-[color:var(--color-tomato-500)]/20 pt-6">
        <h3 className="text-sm font-semibold">Eliminar plantilla</h3>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          {storesUsing > 0
            ? `Esta plantilla está en uso por ${storesUsing} tienda${storesUsing === 1 ? "" : "s"}. Reasignalas antes de eliminar.`
            : "No la usa ninguna tienda. Eliminarla es irreversible."}
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={storesUsing > 0}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-tomato-500)]/40 px-3 py-1.5 text-xs font-medium text-[color:var(--color-tomato-600)] transition hover:bg-[color:var(--color-tomato-500)]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Eliminar
          </button>
        ) : (
          <DeleteForm
            templateId={templateId}
            templateName={templateName}
            onCancel={() => setConfirmDelete(false)}
            onDeleted={() => {
              router.push("/admin/plantillas");
              router.refresh();
            }}
          />
        )}
      </div>
    </section>
  );
}

function ReassignBlock({
  fromTemplateId,
  storesUsing,
  otherTemplates,
}: {
  fromTemplateId: string;
  storesUsing: number;
  otherTemplates: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(reassignStoresToTemplateAction, initial);
  return (
    <form action={action} className="mt-2 space-y-3">
      <input type="hidden" name="fromTemplateId" value={fromTemplateId} />
      <h3 className="text-sm font-semibold">Reasignar tiendas a otra plantilla</h3>
      <p className="text-xs text-[color:var(--muted)]">
        Mueve las {storesUsing} tienda{storesUsing === 1 ? "" : "s"} que usan esta plantilla a otra activa.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="toTemplateId"
          required
          defaultValue=""
          className="flex-1 rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
        >
          <option value="" disabled>
            Elegir plantilla destino…
          </option>
          {otherTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <ReassignButton />
      </div>
      {state.ok && (
        <p className="text-xs text-emerald-700">✓ Tiendas reasignadas correctamente.</p>
      )}
      {state.error && (
        <p className="text-xs text-[color:var(--color-tomato-600)]">{state.error}</p>
      )}
    </form>
  );
}

function ReassignButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-bark-900)] px-3 py-2 text-xs font-medium text-white hover:bg-[color:var(--color-bark-700)] disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-3.5" />}
      {pending ? "Reasignando…" : "Reasignar"}
    </button>
  );
}

function DeleteForm({
  templateId,
  templateName,
  onCancel,
  onDeleted,
}: {
  templateId: string;
  templateName: string;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [state, action] = useActionState(deleteTemplateAction, initial);
  useDoneOnce(state.ok, onDeleted);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={templateId} />
      <p className="text-xs text-[color:var(--color-tomato-700)]">
        ¿Confirmás eliminar <strong>{templateName}</strong>? Esta acción es irreversible.
      </p>
      <div className="flex items-center gap-2">
        <DeleteButton />
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-[color:var(--color-tomato-600)]">{state.error}</p>
      )}
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-tomato-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--color-tomato-600)] disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-3.5" />}
      {pending ? "Eliminando…" : "Sí, eliminar"}
    </button>
  );
}
