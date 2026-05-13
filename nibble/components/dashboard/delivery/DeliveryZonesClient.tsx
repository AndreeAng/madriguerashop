"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Bike, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteDeliveryZoneAction,
  upsertDeliveryZoneAction,
  type DeliveryZoneFormState,
} from "@/server/actions/delivery-zones";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";
import { MapCirclePreview, MapZoneEditor } from "@/components/shared/MapsClient";
import { formatBob } from "@/lib/utils";

type Zone = {
  id: string;
  name: string;
  fee: string;
  estimatedTime: string;
  isActive: boolean;
  ordersCount: number;
  /** Geometría del círculo (si el owner la configuró). Null = legacy
   *  (zona sin shape; sólo aparece en select manual). */
  shape: { lat: number; lng: number; radiusMeters: number } | null;
};

const initial: DeliveryZoneFormState = {};

/** Form de crear/editar dentro de un modal liviano. */
function ZoneForm({
  zone,
  onDone,
  onCancel,
}: {
  zone: Zone | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState(upsertDeliveryZoneAction, initial);
  const fe = state.fieldErrors ?? {};

  // Cerrar al confirmar guardado exitoso. El parent refresca el server data.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="space-y-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">
          {zone ? `Editar: ${zone.name}` : "Nueva zona"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar"
          className="grid size-8 place-items-center rounded-full hover:bg-[color:var(--bg)]"
        >
          <X className="size-4" />
        </button>
      </div>

      {zone && <input type="hidden" name="id" value={zone.id} />}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Field
          label="Nombre de la zona"
          name="name"
          placeholder="Centro, Norte, Cala Cala…"
          defaultValue={zone?.name ?? ""}
          error={fe.name}
          required
        />
        <Field
          label="Tarifa (Bs)"
          name="fee"
          inputMode="decimal"
          placeholder="10.00"
          defaultValue={zone?.fee ?? ""}
          error={fe.fee}
          required
        />
        <Field
          label="Tiempo estimado"
          name="estimatedTime"
          placeholder="30–45 min"
          defaultValue={zone?.estimatedTime ?? ""}
          error={fe.estimatedTime}
          hint="Opcional, visible al cliente"
        />
      </div>

      {/* Editor de mapa: el owner marca el centro y ajusta el radio. La
          zona puede crearse sin shape (fallback a select manual en
          checkout) pero recomendamos dibujarla. */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-[color:var(--muted)]">
          Área de cobertura
        </p>
        <MapZoneEditor
          initialLat={zone?.shape?.lat ?? null}
          initialLng={zone?.shape?.lng ?? null}
          initialRadiusMeters={zone?.shape?.radiusMeters ?? null}
        />
        {(fe.centerLat || fe.centerLng || fe.radiusMeters) && (
          <p
            role="alert"
            className="text-xs text-[color:var(--color-tomato-600)]"
          >
            {fe.centerLat || fe.centerLng || fe.radiusMeters}
          </p>
        )}
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={zone?.isActive ?? true}
          className="size-4 rounded border-[color:var(--line-strong)]"
        />
        Zona activa (visible en el checkout)
      </label>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </button>
        <SubmitButton shape="pill" size="sm">
          {zone ? "Guardar cambios" : "Crear zona"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeliveryZonesClient({ zones }: { zones: Zone[] }) {
  const [mode, setMode] = useState<
    { type: "list" } | { type: "new" } | { type: "edit"; zone: Zone }
  >({ type: "list" });
  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(zone: Zone) {
    setError(null);
    const fd = new FormData();
    fd.set("id", zone.id);
    startTransition(async () => {
      const res = await deleteDeliveryZoneAction(fd);
      if (res.error) setError(res.error);
    });
  }

  if (mode.type !== "list") {
    return (
      <ZoneForm
        zone={mode.type === "edit" ? mode.zone : null}
        onDone={() => setMode({ type: "list" })}
        onCancel={() => setMode({ type: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--muted)]">
          {zones.length === 0
            ? "Sin zonas configuradas todavía."
            : `${zones.length} ${zones.length === 1 ? "zona" : "zonas"}`}
        </p>
        <button
          type="button"
          onClick={() => setMode({ type: "new" })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
        >
          <Plus className="size-4" />
          Nueva zona
        </button>
      </div>

      {zones.length === 0 ? (
        <EmptyState
          icon={<Bike className="size-8" />}
          description={
            <>
              Sin zonas — los pedidos de delivery van a usar tu{" "}
              <strong className="text-[color:var(--fg)]">tarifa por defecto</strong>{" "}
              (definida en Configuración).
            </>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
          {zones.map((z) => (
            <li
              key={z.id}
              className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] p-4 last:border-b-0"
            >
              {/* Si la zona tiene círculo dibujado, mostramos el preview del
                  mapa en lugar del icono genérico. Cuando es legacy (sin
                  shape), cae al icono — mejor que un cuadro vacío. */}
              {z.shape ? (
                <MapCirclePreview
                  lat={z.shape.lat}
                  lng={z.shape.lng}
                  radiusMeters={z.shape.radiusMeters}
                  size={56}
                />
              ) : (
                <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-[color:var(--card-soft)] text-[color:var(--fg-soft)]">
                  <Bike className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {z.name}
                  {!z.isActive && (
                    <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                      Inactiva
                    </span>
                  )}
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  {formatBob(Number(z.fee))}
                  {z.estimatedTime ? ` · ${z.estimatedTime}` : ""}
                  {z.shape
                    ? ` · radio ${formatRadius(z.shape.radiusMeters)}`
                    : " · sin mapa"}
                  {z.ordersCount > 0
                    ? ` · ${z.ordersCount} pedido${z.ordersCount === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode({ type: "edit", zone: z })}
                aria-label={`Editar ${z.name}`}
                className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(z)}
                aria-label={`Eliminar ${z.name}`}
                className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar "${pendingDelete?.name}"?`}
        message={
          pendingDelete && pendingDelete.ordersCount > 0
            ? `Esta zona ya tuvo ${pendingDelete.ordersCount} pedido${pendingDelete.ordersCount === 1 ? "" : "s"}. No se elimina del histórico — queda marcada como inactiva.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel={
          pendingDelete && pendingDelete.ordersCount > 0
            ? "Desactivar"
            : "Eliminar"
        }
        destructive
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function formatRadius(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

// ============== Sub-componente Field ==============

function Field({
  label,
  name,
  placeholder,
  defaultValue,
  error,
  required,
  hint,
  inputMode,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  inputMode?: "text" | "decimal" | "numeric";
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
        inputMode={inputMode}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
      />
      {error ? (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      ) : null}
    </label>
  );
}
