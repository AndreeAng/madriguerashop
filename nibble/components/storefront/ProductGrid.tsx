"use client";

import { useState } from "react";
import type { ProductView, StoreView } from "@/lib/storefront/types";
import { ProductCard } from "./ProductCard";
import { ProductQuickView } from "./ProductQuickView";

/**
 * Grid responsivo de productos con QuickView modal compartido. Lo usan
 * la página de categoría y la de búsqueda — ambas necesitan exactamente la
 * misma interacción (click producto → modal con agregar al carrito) y
 * sería un anti-pattern duplicar el state management entre páginas.
 *
 * El home (`StorefrontMenu`) tiene su propia layout (hero + categorías
 * navegables) así que no comparte este grid — pero sí el patrón de modal.
 */
export function ProductGrid({
  store,
  products,
}: {
  store: StoreView;
  products: ProductView[];
}) {
  const [active, setActive] = useState<ProductView | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} onOpen={setActive} />
        ))}
      </div>
      {active && (
        <ProductQuickView
          product={active}
          city={store.city}
          storeSlug={store.slug}
          vertical={store.vertical}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
