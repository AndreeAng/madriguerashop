"use client";

import { ChevronRight } from "lucide-react";
import type { StoreVertical } from "@prisma/client";
import { storefrontCopy } from "@/lib/storefront/copy";
import { formatBob } from "@/lib/utils";
import { useCartSummary } from "@/hooks/useCartSummary";

/** Barra del carrito en mobile. Solo aparece cuando hay items. */
export function FloatingCartBar({
  storeSlug,
  vertical,
  initialCount,
  initialSubtotal,
}: {
  storeSlug: string;
  vertical: StoreVertical;
  initialCount: number;
  initialSubtotal: number;
}) {
  const copy = storefrontCopy(vertical);
  const { itemCount, subtotal } = useCartSummary(storeSlug, {
    itemCount: initialCount,
    subtotal: initialSubtotal,
  });
  if (itemCount <= 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 md:hidden"
      style={{
        bottom: "var(--cookie-banner-h, 0px)",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <a
        href={`/${storeSlug}/checkout`}
        aria-label={`Ir al checkout. ${copy.cartLabel} con ${itemCount} ${itemCount === 1 ? copy.itemSingular : copy.itemPlural}, total ${formatBob(subtotal)}`}
        className="flex h-14 items-center justify-between rounded-full bg-[color:var(--color-bark-900)] px-5 text-white shadow-float"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-[color:var(--store-action)] text-xs font-bold num-tabular text-[color:var(--store-on-action)]">
            {itemCount}
          </span>
          {copy.cartLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="num-tabular">{formatBob(subtotal)}</span>
          <ChevronRight className="size-4" />
        </span>
      </a>
    </div>
  );
}
