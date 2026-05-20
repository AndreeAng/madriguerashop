"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Modal de confirmación. Reemplaza `window.confirm()` nativo:
 *  - Bloquea el hilo del browser cuando lo invoca el JS (`confirm()` lo hace).
 *  - Sin estilos consistentes con el resto de la app.
 *  - Algunos browsers lo suprimen dentro de iframes.
 *
 * Uso típico:
 *   const [openDelete, setOpenDelete] = useState<{ id: string; name: string } | null>(null);
 *   ...
 *   <button onClick={() => setOpenDelete({ id, name })}>Eliminar</button>
 *   <ConfirmDialog
 *     open={openDelete !== null}
 *     title={`¿Eliminar "${openDelete?.name}"?`}
 *     message="Esta acción es permanente."
 *     confirmLabel="Eliminar"
 *     destructive
 *     onConfirm={() => { handleDelete(openDelete!.id); setOpenDelete(null); }}
 *     onCancel={() => setOpenDelete(null)}
 *   />
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Foco inicial: si el dialog es destructive, enfocamos el botón Cancelar
  // (WCAG 3.3.4 Error Prevention) — un Enter accidental no debe ejecutar
  // la acción destructiva. Para diálogos no-destructivos, foco al confirm
  // es la convención que acelera el happy path.
  useEffect(() => {
    if (!open) return;
    if (destructive) {
      cancelRef.current?.focus();
    } else {
      confirmRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, destructive]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-tomato-600)]"
              aria-hidden="true"
            />
          )}
          <div className="flex-1">
            <h2 id={titleId} className="font-display text-lg leading-snug">
              {title}
            </h2>
            {message && (
              <p className="mt-1.5 text-sm text-[color:var(--muted)]">{message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--card)]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`press rounded-xl px-4 py-2 text-sm font-medium text-white ${
              destructive
                ? "bg-[color:var(--color-tomato-600)] hover:bg-[color:var(--color-tomato-700)]"
                : "bg-[color:var(--color-bark-900)] hover:bg-[color:var(--color-bark-700)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
