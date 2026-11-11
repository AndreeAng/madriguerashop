"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutTemplate } from "lucide-react";

/**
 * Preview de una plantilla. Si la imagen no existe (p. ej. el seed apunta a
 * /templates/*.png y el archivo no está en public/), muestra un recuadro con
 * el nombre en vez del ícono de imagen rota y el texto alternativo.
 */
export function TemplatePreviewImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Si la imagen ya falló antes de hidratar, `onError` no llega a correr:
  // se revisa el estado del <img> al montar.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed || !src) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 text-[color:var(--muted)]">
        <LayoutTemplate aria-hidden="true" className="size-6" />
        <span className="text-xs font-medium">Sin imagen de preview</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={`Preview de ${name}`}
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
  );
}
