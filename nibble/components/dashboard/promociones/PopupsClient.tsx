"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deletePopupAction,
  upsertPopupAction,
  type PopupFormState,
} from "@/server/actions/popups";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";
import { LinkTargetPicker } from "@/components/dashboard/promociones/LinkTargetPicker";
import type { PickerContext } from "@/components/dashboard/promociones/BannersClient";

type Popup = {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  delaySeconds: number;
  showOncePerSession: boolean;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
};

const initial: PopupFormState = {};

export function PopupsClient({
  popups,
  pickerContext,
}: {
  popups: Popup[];
  pickerContext: PickerContext;
}) {
  const [mode, setMode] = useState<
    { type: "list" } | { type: "new" } | { type: "edit"; popup: Popup }
  >({ type: "list" });
  const [pendingDelete, setPendingDelete] = useState<Popup | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(p: Popup) {
    setError(null);
    const fd = new FormData();
    fd.set("id", p.id);
    startTransition(async () => {
      const res = await deletePopupAction(fd);
      if (res.error) setError(res.error);
    });
  }

  if (mode.type !== "list") {
    return (
      <PopupForm
        popup={mode.type === "edit" ? mode.popup : null}
        onDone={() => setMode({ type: "list" })}
        pickerContext={pickerContext}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--muted)]">
          {popups.length === 0
            ? "Sin popups todavía."
            : `${popups.length} ${popups.length === 1 ? "popup" : "popups"}`}
          {" · "}
          <span className="text-xs">
            Sólo se muestra UNO al cliente (el primer activo en ventana).
          </span>
        </p>
        <button
          type="button"
          onClick={() => setMode({ type: "new" })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
        >
          <Plus className="size-4" />
          Nuevo popup
        </button>
      </div>

      {popups.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-8" />}
          description="Sin popups. Útiles para anuncios fuertes: cierre por feriado, nuevo producto destacado, encuesta corta."
        />
      ) : (
        <ul className="space-y-3">
          {popups.map((p) => (
            <PopupRow
              key={p.id}
              popup={p}
              onEdit={() => setMode({ type: "edit", popup: p })}
              onDelete={() => setPendingDelete(p)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar "${pendingDelete?.title}"?`}
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
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

function PopupRow({
  popup,
  onEdit,
  onDelete,
}: {
  popup: Popup;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const live = isLiveNow(popup);
  return (
    <li className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[color:var(--bg)] text-[color:var(--muted)]">
          {popup.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={popup.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <MessageSquare className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{popup.title}</p>
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                EN VIVO
              </span>
            ) : !popup.isActive ? (
              <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                Inactivo
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Programado
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--muted)]">
            {popup.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--muted)]">
            <span>{popup.delaySeconds}s de delay</span>
            {popup.showOncePerSession && <span>· una vez/sesión</span>}
            {popup.ctaText && popup.ctaUrl && (
              <span className="truncate">· CTA: {popup.ctaText}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar"
            className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Eliminar"
            className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ============== Form ==============

function PopupForm({
  popup,
  onDone,
  pickerContext,
}: {
  popup: Popup | null;
  onDone: () => void;
  pickerContext: PickerContext;
}) {
  const [state, action] = useActionState(upsertPopupAction, initial);
  const [imageUrl, setImageUrl] = useState(popup?.imageUrl ?? "");
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const validFromLocal = popup?.validFrom ? toLocalInput(popup.validFrom) : "";
  const validToLocal = popup?.validTo ? toLocalInput(popup.validTo) : "";

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">
          {popup ? "Editar popup" : "Nuevo popup"}
        </h2>
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

      {popup && <input type="hidden" name="id" value={popup.id} />}

      <Field
        label="Título"
        name="title"
        placeholder="¡Nueva temporada de cumpleaños!"
        defaultValue={popup?.title ?? ""}
        error={fe.title}
        required
      />
      <TextareaField
        label="Mensaje"
        name="message"
        placeholder="Decorá tu evento con nuestros combos especiales. Reservá hasta 7 días antes."
        defaultValue={popup?.message ?? ""}
        error={fe.message}
        required
      />

      <ImageUploadField
        label="Imagen (opcional)"
        value={imageUrl}
        onChange={setImageUrl}
        error={fe.imageUrl}
        hint="Recomendado: 800×600 px. Si no la subís, el popup es solo texto."
      />

      <Field
        label="Texto del botón (opcional)"
        name="ctaText"
        placeholder="Ver combos"
        defaultValue={popup?.ctaText ?? ""}
        error={fe.ctaText}
        hint="Si dejás texto y destino, aparece un botón en el popup."
      />

      <LinkTargetPicker
        label="¿A dónde lleva el botón? (opcional)"
        name="ctaUrl"
        defaultValue={popup?.ctaUrl ?? ""}
        storeSlug={pickerContext.storeSlug}
        storeWhatsappPhone={pickerContext.storeWhatsappPhone}
        categories={pickerContext.categories}
        products={pickerContext.products}
        error={fe.ctaUrl}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Delay (segundos)"
          name="delaySeconds"
          type="number"
          defaultValue={String(popup?.delaySeconds ?? 3)}
          error={fe.delaySeconds}
          hint="0 = al instante. Recomendado 2–5s."
        />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="showOncePerSession"
            defaultChecked={popup?.showOncePerSession ?? true}
            className="size-4 rounded border-[color:var(--line-strong)]"
          />
          Mostrar una sola vez por visitante (recomendado)
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Mostrar desde (opcional)"
          name="validFrom"
          type="datetime-local"
          defaultValue={validFromLocal}
          error={fe.validFrom}
        />
        <Field
          label="Mostrar hasta (opcional)"
          name="validTo"
          type="datetime-local"
          defaultValue={validToLocal}
          error={fe.validTo}
        />
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={popup?.isActive ?? true}
          className="size-4 rounded border-[color:var(--line-strong)]"
        />
        Popup activo
      </label>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-4 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </button>
        <SubmitButton shape="pill" size="sm">Guardar</SubmitButton>
      </div>
    </form>
  );
}

function ImageUploadField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLocalError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", "banner"); // reusamos el bucket "banner"
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Error");
      onChange(data.url);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-[color:var(--muted)]">{label}</p>
      <input type="hidden" name="imageUrl" value={value} />
      <div className="mt-2 flex flex-wrap items-start gap-3">
        {value ? (
          <div className="relative size-24 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Quitar"
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div className="grid size-24 place-items-center rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--muted)]">
            <ImageIcon className="size-5" />
          </div>
        )}
        <div className="flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-2 text-sm font-medium hover:border-[color:var(--color-bark-300)] disabled:opacity-50"
          >
            <Upload className="size-4" />
            {uploading ? "Subiendo…" : value ? "Cambiar" : "Subir"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {(error || localError) && (
            <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
              {error || localError}
            </p>
          )}
          {hint && !error && !localError && (
            <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  error,
  required,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  hint?: string;
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
        defaultValue={defaultValue}
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

function TextareaField({
  label,
  name,
  placeholder,
  defaultValue,
  error,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
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
      <textarea
        name={name}
        rows={3}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`mt-1 w-full resize-none rounded-xl border ${
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isLiveNow(p: Popup): boolean {
  if (!p.isActive) return false;
  const now = new Date();
  if (p.validFrom && new Date(p.validFrom) > now) return false;
  if (p.validTo && new Date(p.validTo) < now) return false;
  return true;
}
