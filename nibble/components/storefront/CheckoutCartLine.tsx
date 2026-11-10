"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import {
  updateCartItemQuantity,
  type CartLine,
  type CartSnapshot,
} from "@/server/actions/cart";
import { formatBob } from "@/lib/utils";

const MAX_QTY = 99;

/**
 * Línea editable del resumen del checkout. `isOnlyLine` pide confirmación
 * antes de quitar: vaciar el carrito lleva de vuelta a la tienda y se pierde
 * lo escrito en el formulario.
 */
export function CheckoutCartLine({
  storeSlug,
  line,
  isOnlyLine,
  emptyWarning,
  locked,
  onChanged,
  onBusy,
}: {
  storeSlug: string;
  line: CartLine;
  isOnlyLine: boolean;
  /** Texto de la confirmación al quitar la última línea. */
  emptyWarning: string;
  /** El formulario se está enviando. */
  locked: boolean;
  onChanged: (cart: CartSnapshot, removed: boolean) => void;
  onBusy: (delta: 1 | -1) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const confirmOpened = useRef(false);

  useEffect(() => {
    if (!pending) return;
    onBusy(1);
    return () => onBusy(-1);
  }, [pending, onBusy]);

  useEffect(() => {
    if (confirming) {
      confirmOpened.current = true;
      cancelRef.current?.focus();
    } else if (confirmOpened.current) {
      confirmOpened.current = false;
      removeRef.current?.focus();
    }
  }, [confirming]);

  async function setQuantity(quantity: number) {
    setError(null);
    setPending(true);
    try {
      const cart = await updateCartItemQuantity({
        storeSlug,
        cartItemId: line.id,
        quantity,
      });
      if (!cart || cart.items.length === 0) {
        router.replace(`/${storeSlug}`);
        return;
      }
      onChanged(cart, quantity === 0);
    } catch {
      setError("No pudimos actualizar este producto. Prueba de nuevo.");
    } finally {
      setPending(false);
    }
  }

  const disabled = pending || locked;

  return (
    <li className="py-3" aria-busy={pending || undefined}>
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{line.product.name}</p>
          {line.variant && (
            <p className="text-xs text-[color:var(--muted)]">{line.variant.name}</p>
          )}
          <p className="mt-1 text-xs text-[color:var(--muted)] num-tabular">
            {formatBob(line.unitPrice)} c/u
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium num-tabular">
          {formatBob(line.lineTotal)}
        </span>
      </div>

      {confirming ? (
        <div className="mt-2 rounded-xl bg-[color:var(--bg)] p-3">
          <p className="text-xs text-[color:var(--fg-soft)]">{emptyWarning}</p>
          <div className="mt-1 flex justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              disabled={disabled}
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-full px-4 text-sm font-medium text-[color:var(--fg-soft)] transition hover:bg-[color:var(--card-soft)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setQuantity(0)}
              className="min-h-11 rounded-full bg-[color:var(--color-tomato-600)] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Quitando…" : "Quitar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg)]">
            <button
              type="button"
              // aria-disabled: `disabled` tiraría el foco a <body> en cada toque.
              aria-disabled={disabled || line.quantity <= 1}
              onClick={() => {
                if (!disabled && line.quantity > 1) setQuantity(line.quantity - 1);
              }}
              aria-label={`Disminuir cantidad de ${line.product.name}`}
              className="grid size-11 place-items-center rounded-full transition hover:bg-[color:var(--card-soft)] aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
            >
              <Minus aria-hidden className="size-4" />
            </button>
            <span
              aria-live="polite"
              className="w-8 text-center text-sm font-semibold num-tabular"
            >
              <span className="sr-only">Cantidad: </span>
              {line.quantity}
            </span>
            <button
              type="button"
              aria-disabled={disabled || line.quantity >= MAX_QTY}
              onClick={() => {
                if (!disabled && line.quantity < MAX_QTY) setQuantity(line.quantity + 1);
              }}
              aria-label={`Aumentar cantidad de ${line.product.name}`}
              className="grid size-11 place-items-center rounded-full transition hover:bg-[color:var(--card-soft)] aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
            >
              <Plus aria-hidden className="size-4" />
            </button>
          </div>

          <button
            ref={removeRef}
            type="button"
            disabled={disabled}
            onClick={() => (isOnlyLine ? setConfirming(true) : setQuantity(0))}
            aria-label={`Quitar ${line.product.name}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[color:var(--muted)] transition hover:text-[color:var(--color-tomato-600)] disabled:opacity-50"
          >
            <Trash2 aria-hidden className="size-3.5" />
            Quitar
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </li>
  );
}
