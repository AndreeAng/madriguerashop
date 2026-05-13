"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GripVertical, ImagePlus, Loader2, X } from "lucide-react";

type Img = { url: string; alt?: string };

/**
 * Field para administrar múltiples imágenes de un producto.
 *  - Sube cada archivo a /api/upload?kind=product en paralelo
 *  - Mantiene un array en state, persiste como JSON en `name`
 *  - Permite reordenar (drag) y eliminar
 *  - La primera imagen es la "principal" (cover)
 *  - `onUploadingChange` permite al form padre desactivar el submit mientras sube
 */
export function ProductImagesField({
  name,
  initial,
  max = 5,
  onUploadingChange,
}: {
  name: string;
  initial?: Img[];
  max?: number;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [images, setImages] = useState<Img[]>(initial ?? []);
  const [uploading, setUploadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Drag reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Cancelamos uploads si el componente se desmonta (usuario navega antes de
  // que terminen) — sin esto, los `setState` después del fetch pegan en un
  // componente desmontado y dejan al padre con `imagesUploading = true`.
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const setUploading = (v: boolean) => {
    if (!mounted.current) return;
    setUploadingState(v);
    onUploadingChange?.(v);
  };

  useEffect(() => {
    setError(null);
  }, [images.length]);

  async function handleFiles(files: FileList) {
    const remaining = max - images.length;
    if (remaining <= 0) {
      setError(`Máximo ${max} imágenes.`);
      return;
    }
    setError(null);
    setUploading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const toUpload = Array.from(files).slice(0, remaining);
    const results = await Promise.allSettled(
      toUpload.map(async (f) => {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("kind", "product");
        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? "No pudimos subir una imagen");
        }
        return { url: data.url } satisfies Img;
      }),
    );

    if (!mounted.current) return; // usuario navegó — no toques estado

    const uploaded: Img[] = [];
    const errors: string[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") uploaded.push(r.value);
      else if (r.reason?.name !== "AbortError") {
        errors.push(r.reason instanceof Error ? r.reason.message : "Error subiendo imagen");
      }
    }
    if (errors.length > 0) {
      setError(
        errors.length === 1
          ? errors[0]!
          : `${errors.length} imágenes fallaron: ${errors.join(" · ")}`,
      );
    }
    if (uploaded.length > 0) setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
    abortRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  function move(from: number, to: number) {
    if (from === to) return;
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Imágenes <span className="text-[color:var(--color-tomato-600)]">*</span>
        </span>
        <span className="text-[11px] text-[color:var(--muted)]">
          {images.length} / {max}
        </span>
      </div>

      <input type="hidden" name={name} value={JSON.stringify(images)} readOnly />

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img, i) => (
          <div
            key={img.url}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null) move(dragIdx, i);
              setDragIdx(null);
            }}
            className={`relative aspect-square overflow-hidden rounded-xl border bg-[color:var(--bg)] ${
              dragIdx === i
                ? "border-[color:var(--color-amber-400)]"
                : "border-[color:var(--line-strong)]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? ""} className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-[color:var(--color-amber-500)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-pill">
                Principal
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Quitar"
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-[color:var(--color-tomato-600)] shadow-sm transition hover:scale-105"
            >
              <X className="size-3.5" />
            </button>
            <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-black/40 text-white">
              <GripVertical className="size-3" />
            </span>
          </div>
        ))}

        {images.length < max && (
          <label
            htmlFor={id}
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[color:var(--line-strong)] bg-[color:var(--bg)] text-center transition hover:border-[color:var(--color-amber-400)]"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-[color:var(--muted)]" />
            ) : (
              <ImagePlus className="size-5 text-[color:var(--muted)]" />
            )}
            <span className="px-2 text-xs font-medium text-[color:var(--fg-soft)]">
              {uploading ? "Subiendo…" : "Agregar"}
            </span>
            <span className="text-[10px] text-[color:var(--muted)]">JPG · PNG · WebP</span>
          </label>
        )}
      </div>

      <input
        ref={fileRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="sr-only"
      />

      <p className="mt-2 text-xs text-[color:var(--muted)]">
        La primera imagen es la principal. Arrastrá para reordenar.
      </p>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </div>
  );
}
