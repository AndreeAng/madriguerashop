"use client";

import { useSyncExternalStore } from "react";

type CartSummary = { itemCount: number; subtotal: number };

let latest: { storeSlug: string; summary: CartSummary } | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Publica el carrito tras una mutación. El contador no depende de que
 * `router.refresh()` aplique el árbol nuevo: en producción esa actualización
 * podía no llegar a pintarse nunca, y el cliente no veía lo que agregó.
 */
export function publishCartSummary(storeSlug: string, summary: CartSummary) {
  latest = { storeSlug, summary };
  listeners.forEach((listener) => listener());
}

/** El último carrito publicado en esta tienda, o el que vino del servidor. */
export function useCartSummary(storeSlug: string, initial: CartSummary): CartSummary {
  const published = useSyncExternalStore(
    subscribe,
    () => latest,
    () => null,
  );
  return published?.storeSlug === storeSlug ? published.summary : initial;
}
