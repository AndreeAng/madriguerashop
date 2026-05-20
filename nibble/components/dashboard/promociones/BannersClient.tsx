"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  Calendar,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteBannerAction,
  upsertBannerAction,
  type BannerFormState,
} from "@/server/actions/banners";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";
import { LinkTargetPicker } from "@/components/dashboard/promociones/LinkTargetPicker";

/** Datos que el LinkTargetPicker necesita para armar el dropdown de
 *  destinos (categorías + productos + WhatsApp del local). */
export type PickerContext = {
  storeSlug: string;
  storeWhatsappPhone: string;
  categories: { name: string }[];
  products: { slug: string; name: string }[];
};

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
};

const initial: BannerFormState = {};

export function BannersClient({
  banners,
  pickerContext,
}: {
  banners: Banner[];
  pickerContext: PickerContext;
}) {
  const [mode, setMode] = useState<
    { type: "list" } | { type: "new" } | { type: "edit"; banner: Banner }
  >({ type: "list" });
  const [pendingDelete, setPendingDelete] = useState<Banner | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(banner: Banner) {
    setError(null);
    const fd = new FormData();
    fd.set("id", banner.id);
    startTransition(async () => {
      const res = await deleteBannerAction(fd);
      if (res.error) setError(res.error);
    });
  }

  if (mode.type !== "list") {
    return (
      <BannerForm
        banner={mode.type === "edit" ? mode.banner : null}
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
          {banners.length === 0
            ? "Sin banners todavía."
            : `${banners.length} ${banners.length === 1 ? "banner" : "banners"}`}
        </p>
        <button
          type="button"
          onClick={() => setMode({ type: "new" })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
        >
          <Plus className="size-4" />
          Nuevo banner
        </button>
      </div>

      {banners.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-8" />}
          description="Sin banners todavía. Anunciá una promo, un evento o lo que quieras que el cliente vea al entrar a tu tienda."
        />
      ) : (
        <ul className="space-y-3">
          {banners.map((b) => (
            <BannerRow
              key={b.id}
              banner={b}
              onEdit={() => setMode({ type: "edit", banner: b })}
              onDelete={() => setPendingDelete(b)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar este banner?`}
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

// ============== Row de la lista ==============

function BannerRow({
  banner,
  onEdit,
  onDelete,
}: {
  banner: Banner;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const liveNow = isLiveNow(banner);

  return (
    <li className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
      <div className="flex flex-wrap items-stretch gap-4 p-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-[color:var(--bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.imageUrl}
            alt={banner.title ?? "Banner"}
            className="size-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {banner.title || (
                <span className="text-[color:var(--muted)]">(sin título)</span>
              )}
            </p>
            {liveNow ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                EN VIVO
              </span>
            ) : !banner.isActive ? (
              <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                Inactivo
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Programado
              </span>
            )}
          </div>
          {banner.subtitle && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--muted)]">
              {banner.subtitle}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--muted)]">
            {(banner.validFrom || banner.validTo) && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {formatRange(banner.validFrom, banner.validTo)}
              </span>
            )}
            {banner.linkUrl && (
              <span className="truncate">→ {banner.linkUrl}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar banner"
            className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Eliminar banner"
            className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ============== Form crear/editar ==============

function BannerForm({
  banner,
  onDone,
  pickerContext,
}: {
  banner: Banner | null;
  onDone: () => void;
  pickerContext: PickerContext;
}) {
  const [state, action] = useActionState(upsertBannerAction, initial);
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? "");
  const [mobileImageUrl, setMobileImageUrl] = useState(
    banner?.mobileImageUrl ?? "",
  );
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  // Convertir ISO → "YYYY-MM-DDThh:mm" para input type=datetime-local.
  const validFromLocal = banner?.validFrom ? toLocalInput(banner.validFrom) : "";
  const validToLocal = banner?.validTo ? toLocalInput(banner.validTo) : "";

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">
          {banner ? "Editar banner" : "Nuevo banner"}
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

      {banner && <input type="hidden" name="id" value={banner.id} />}

      {/* Imagen principal (obligatoria) */}
      <ImageUploadField
        label="Imagen (obligatorio)"
        name="imageUrl"
        value={imageUrl}
        onChange={setImageUrl}
        error={fe.imageUrl}
        hint="Recomendado: 1600×600 px (3:1). JPG o PNG, hasta 5 MB."
      />

      {/* Imagen mobile opcional */}
      <ImageUploadField
        label="Imagen para móvil (opcional)"
        name="mobileImageUrl"
        value={mobileImageUrl}
        onChange={setMobileImageUrl}
        error={fe.mobileImageUrl}
        hint="Recomendado: 800×800 px (1:1). Si no la subes, se usa la principal."
      />

      <Field
        label="Título (opcional)"
        name="title"
        placeholder="Delivery gratis hasta el viernes"
        defaultValue={banner?.title ?? ""}
        error={fe.title}
      />

      <Field
        label="Subtítulo (opcional)"
        name="subtitle"
        placeholder="En pedidos superiores a Bs 80"
        defaultValue={banner?.subtitle ?? ""}
        error={fe.subtitle}
      />

      <LinkTargetPicker
        label="¿A dónde lleva el click? (opcional)"
        name="linkUrl"
        defaultValue={banner?.linkUrl ?? ""}
        storeSlug={pickerContext.storeSlug}
        storeWhatsappPhone={pickerContext.storeWhatsappPhone}
        categories={pickerContext.categories}
        products={pickerContext.products}
        error={fe.linkUrl}
        hint="Elige una categoría, un producto o WhatsApp. Si dejas 'Sin enlace', la imagen se muestra sola."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Mostrar desde (opcional)"
          name="validFrom"
          type="datetime-local"
          defaultValue={validFromLocal}
          error={fe.validFrom}
          hint="Si lo dejas vacío, está activo ya."
        />
        <Field
          label="Mostrar hasta (opcional)"
          name="validTo"
          type="datetime-local"
          defaultValue={validToLocal}
          error={fe.validTo}
          hint="Si lo dejas vacío, no expira."
        />
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={banner?.isActive ?? true}
          className="size-4 rounded border-[color:var(--line-strong)]"
        />
        Banner activo
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

// ============== Upload de imagen con preview ==============

function ImageUploadField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (url: string) => void;
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
      fd.set("kind", "banner");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "No pudimos subir la imagen");
      }
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
      <input type="hidden" name={name} value={value} />

      <div className="mt-2 flex flex-wrap items-start gap-3">
        {value ? (
          <div className="relative size-24 overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Quitar imagen"
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
            {uploading
              ? "Subiendo…"
              : value
                ? "Cambiar imagen"
                : "Subir imagen"}
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
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}
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

// ============== Helpers ==============

/** Convierte ISO UTC → "YYYY-MM-DDTHH:mm" en local time para datetime-local. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** El banner está "vivo" ahora si está activo Y dentro de la ventana de fechas. */
function isLiveNow(b: Banner): boolean {
  if (!b.isActive) return false;
  const now = new Date();
  if (b.validFrom && new Date(b.validFrom) > now) return false;
  if (b.validTo && new Date(b.validTo) < now) return false;
  return true;
}

function formatRange(from: string | null, to: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  if (from && to) return `${fmt(from)} → ${fmt(to)}`;
  if (from) return `desde ${fmt(from)}`;
  if (to) return `hasta ${fmt(to)}`;
  return "";
}
