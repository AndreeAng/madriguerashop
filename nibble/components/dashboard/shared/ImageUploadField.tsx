"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { ImageKind } from "@/lib/storage/upload";

/**
 * Input compuesto para subir imágenes.
 *
 * Funcionamiento:
 *  - El usuario selecciona un archivo → se sube a /api/upload
 *  - Cuando vuelve la URL, queda en un input hidden con `name`, listo para
 *    el submit del form padre.
 *  - Si ya existe una URL inicial, se muestra como preview con botón "quitar".
 */
export function ImageUploadField({
  name,
  label,
  kind,
  initialUrl,
  hint,
  error,
  aspect = "square",
  onChange,
}: {
  name: string;
  label: string;
  kind: ImageKind;
  initialUrl?: string | null;
  hint?: string;
  error?: string;
  aspect?: "square" | "wide" | "tall";
  onChange?: (url: string) => void;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrlState] = useState<string>(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const setUrl = (next: string) => {
    setUrlState(next);
    onChange?.(next);
  };

  const aspectClass =
    aspect === "wide"
      ? "aspect-[16/9]"
      : aspect === "tall"
        ? "aspect-[3/4]"
        : "aspect-square";

  async function handleFile(file: File) {
    setErrorLocal(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErrorLocal(data.error ?? "No pudimos subir la imagen");
        return;
      }
      setUrl(data.url);
    } catch {
      setErrorLocal("Error de red. Prueba de nuevo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <input type="hidden" name={name} value={url} readOnly />

      <div className="mt-1.5">
        {url ? (
          <div className={`relative w-full max-w-xs overflow-hidden rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] ${aspectClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label}
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => setUrl("")}
              className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white text-[color:var(--color-tomato-600)] shadow-sm transition hover:scale-105"
              aria-label="Quitar imagen"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor={id}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[color:var(--line-strong)] bg-[color:var(--bg)] p-6 text-center transition hover:border-[color:var(--color-amber-400)] hover:bg-[color:var(--card)] ${aspectClass} max-w-xs`}
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-[color:var(--muted)]" />
            ) : (
              <ImagePlus className="size-6 text-[color:var(--muted)]" />
            )}
            <span className="text-xs font-medium text-[color:var(--fg-soft)]">
              {uploading ? "Subiendo…" : "Click para subir"}
            </span>
            <span className="text-[10px] text-[color:var(--muted)]">
              JPG · PNG · WebP · máx 5 MB
            </span>
          </label>
        )}
        <input
          ref={fileRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="sr-only"
        />
      </div>

      {hint && !error && !errorLocal && (
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
      {(error ?? errorLocal) && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error ?? errorLocal}
        </p>
      )}
    </div>
  );
}
