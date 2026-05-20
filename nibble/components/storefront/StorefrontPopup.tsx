"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

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
 *  - Focus trap mínimo: Tab cicla dentro del dialog, Shift+Tab también.
 *    Sin esto, `aria-modal="true"` mentía a screen readers — el foco se
 *    escapaba al contenido oculto detrás del overlay.
 *  - `Escape` lo cierra, click afuera también.
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

  // Escape para cerrar + focus trap + restore focus al cerrar (WCAG 2.4.3).
  useEffect(() => {
    if (!open) return;
    // Capturamos el elemento que tenía el foco antes de abrir el modal
    // para devolverle el foco al cerrar — sin esto el foco salta al
    // `<body>` y el usuario de teclado pierde el contexto.
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a, button, input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restaurar foco solo si el opener sigue en el DOM y enfocable.
      if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, [open]);

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
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
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
