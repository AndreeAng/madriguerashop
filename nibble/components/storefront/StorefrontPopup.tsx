"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";

/**
 * Modal popup que aparece tras `delaySeconds` desde que el cliente
 * carga el storefront. Si `showOncePerSession`, deja un flag en
 * `sessionStorage` para no volver a aparecer hasta cerrar la pestaña.
 *
 * Decisiones:
 *  - El RSC ya filtró por `isActive` + ventana de fechas. Acá sólo
 *    decidimos timing + once-per-session.
 *  - `sessionStorage` (no localStorage): si el cliente cierra la pestaña
 *    y vuelve mañana, queremos volver a mostrar el popup. Si lo
 *    cerramos para siempre, el merchant pierde un canal valioso.
 *  - Foco y teclado en `useDialogFocus`. Click afuera también cierra.
 */
export function StorefrontPopup({
  popupId,
  title,
  message,
  imageUrl,
  ctaText,
  ctaUrl,
  delaySeconds,
  showOncePerSession,
}: {
  popupId: string;
  title: string;
  message: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  delaySeconds: number;
  showOncePerSession: boolean;
}) {
  const [open, setOpen] = useState(false);
  // `useId()` evita colisión si dos dialogs coexisten (animación de
  // salida + apertura encadenada). Antes el id era `"popup-title"`
  // hardcodeado y el screen reader leía el título del primero al
  // abrir el segundo.
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const key = `popup_seen_${popupId}`;
    if (showOncePerSession && sessionStorage.getItem(key) === "1") {
      return; // ya lo vio en esta sesión
    }
    const t = setTimeout(() => {
      setOpen(true);
      if (showOncePerSession) sessionStorage.setItem(key, "1");
    }, delaySeconds * 1000);
    return () => clearTimeout(t);
  }, [popupId, delaySeconds, showOncePerSession]);

  useDialogFocus({
    open,
    dialogRef,
    initialFocusRef: closeRef,
    onEscape: () => setOpen(false),
  });

  if (!open) return null;

  const isExternalCta = ctaUrl && /^https?:\/\//.test(ctaUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[color:var(--card)] shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
        >
          <X className="size-4" />
        </button>

        {imageUrl && (
          <div className="aspect-[4/3] w-full overflow-hidden bg-[color:var(--bg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="size-full object-cover" />
          </div>
        )}

        <div className="p-6">
          <h2 id={titleId} className="font-display text-2xl leading-tight">
            {title}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-[color:var(--fg-soft)]">
            {message}
          </p>

          {ctaText && ctaUrl && (
            <div className="mt-5">
              <Link
                href={ctaUrl}
                target={isExternalCta ? "_blank" : undefined}
                rel={isExternalCta ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-bark-900)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--color-bark-700)]"
              >
                {ctaText}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
