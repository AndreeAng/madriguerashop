"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import type { StoreVertical } from "@prisma/client";
import type { ProductView } from "@/lib/storefront/types";
import { addItemToCart } from "@/server/actions/cart";
import { formatBob } from "@/lib/utils";
import { storefrontCopy } from "@/lib/storefront/copy";

export function ProductPdpAdd({
  product,
  storeSlug,
  vertical,
}: {
  product: ProductView;
  storeSlug: string;
  vertical: StoreVertical;
}) {
  const copy = storefrontCopy(vertical);
  // Selecciona por default la PRIMERA variante disponible. Si todas están
  // agotadas, deja el índice en la primera (igual el botón se deshabilita
  // vía `product.available`).
  const firstAvailableIdx = product.variants?.findIndex((v) => v.available) ?? -1;
  const defaultIdx = firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
  const [variantIdx, setVariantIdx] = useState(defaultIdx);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const variant = product.variants?.[variantIdx];
  const unitPrice = product.price + (variant?.priceDelta ?? 0);
  // El producto puede estar `available` globalmente pero la variante elegida
  // específica estar agotada — bloqueamos el add en ese caso.
  const variantAvailable = variant ? variant.available : true;
  const canAdd = product.available && variantAvailable;

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      try {
        await addItemToCart({
          storeSlug,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity: qty,
          notes: notes.trim() || null,
        });
        // Refresh antes del push para que la cookie del cart esté propagada
        // cuando el RSC del checkout corra getCartSnapshot.
        router.refresh();
        router.push(`/${storeSlug}/checkout`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar al carrito");
      }
    });
  };

  return (
    <>
      {product.variants && product.variants.length > 0 && (
        <div className="mt-7">
          <p className="text-sm font-medium">{copy.variantLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((v, i) => {
              const isActive = i === variantIdx;
              const variantPrice = product.price + v.priceDelta;
              const isDisabled = !v.available;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => !isDisabled && setVariantIdx(i)}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  aria-disabled={isDisabled}
                  className={`relative rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    isDisabled
                      ? "cursor-not-allowed border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--muted)] opacity-60"
                      : isActive
                        ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                        : "border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
                  }`}
                >
                  <div className={`font-medium ${isDisabled ? "line-through" : ""}`}>
                    {v.name}
                  </div>
                  <div className="text-xs opacity-80">
                    {isDisabled ? "Agotado" : formatBob(variantPrice)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-7">
        <label htmlFor="pdp-notes" className="text-sm font-medium">
          {copy.productNotesLabel} (opcional)
        </label>
        <textarea
          id="pdp-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.productNotesPlaceholder}
          className="mt-2 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-[color:var(--color-tomato-50)] px-3 py-2 text-xs text-[color:var(--color-tomato-700)]">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--card)]">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || pending}
            aria-label="Disminuir cantidad"
            className="size-10 rounded-full hover:bg-[color:var(--line)] disabled:opacity-30"
          >
            <Minus className="mx-auto size-4" />
          </button>
          <span className="num-tabular w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            disabled={pending}
            aria-label="Aumentar cantidad"
            className="size-10 rounded-full hover:bg-[color:var(--line)] disabled:opacity-30"
          >
            <Plus className="mx-auto size-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={!canAdd || pending}
          onClick={handleAdd}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-[color:var(--color-bark-700)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ShoppingBag className="size-4" />
          {!product.available
            ? "No disponible"
            : !variantAvailable
              ? "Variante agotada"
              : pending
                ? "Agregando…"
                : `Agregar — ${formatBob(unitPrice * qty)}`}
        </button>
      </div>
    </>
  );
}
