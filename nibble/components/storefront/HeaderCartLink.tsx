"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { StoreVertical } from "@prisma/client";
import { storefrontCopy } from "@/lib/storefront/copy";
import { useCartSummary } from "@/hooks/useCartSummary";

export function HeaderCartLink({
  storeSlug,
  vertical,
  initialCount,
}: {
  storeSlug: string;
  vertical: StoreVertical;
  initialCount: number;
}) {
  const copy = storefrontCopy(vertical);
  const { itemCount } = useCartSummary(storeSlug, {
    itemCount: initialCount,
    subtotal: 0,
  });

  return (
    <Link
      href={`/${storeSlug}/checkout`}
      aria-label={
        itemCount > 0
          ? `${copy.cartLabel} con ${itemCount} ${itemCount === 1 ? copy.itemSingular : copy.itemPlural}`
          : `${copy.cartLabel} vacío`
      }
      className="relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full bg-[color:var(--color-bark-900)] pl-4 pr-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[color:var(--color-bark-800)] hover:scale-[1.02] active:scale-95"
    >
      <ShoppingBag aria-hidden className="size-4" />
      <span className="hidden sm:inline">{copy.cartLabel}</span>
      {itemCount > 0 && (
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full bg-[color:var(--color-amber-400)] text-xs font-bold text-[color:var(--color-bark-900)] num-tabular"
        >
          {itemCount}
        </span>
      )}
    </Link>
  );
}
