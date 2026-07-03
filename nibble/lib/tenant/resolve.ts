import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Store, StoreStatus } from "@prisma/client";

const BLOCKED_STATUSES: StoreStatus[] = ["SUSPENDED", "CANCELLED"];

/**
 * Resuelve una tienda por slug. Cacheado por request (React `cache`)
 * para que múltiples consumers en el mismo render compartan una sola query.
 */
export const getStoreBySlug = cache(async (slug: string): Promise<Store | null> => {
  if (!slug) return null;
  return db.store.findUnique({
    where: { slug },
  });
});

/**
 * Resuelve la store visible al público (excluye SUSPENDED/CANCELLED, permite
 * ACTIVE y PAST_DUE) con las relaciones que el storefront necesita
 * (template, hours, plan). Devuelve `null` si no existe o está bloqueada.
 *
 * IMPORTANTE: el caller debe llamar `notFound()` si devuelve null. Next 15
 * tiene un quirk: `notFound()` dentro de un `cache()` wrapper no propaga el
 * status 404 correctamente — el not-found.tsx renderea OK pero el response
 * queda en 200 (mal para SEO; Google podría indexar slugs inexistentes como
 * páginas válidas). Mover `notFound()` al caller restaura el 404 real.
 */
export const getStorefrontData = cache(async (slug: string) => {
  const store = await db.store.findUnique({
    where: { slug },
    include: {
      template: true,
      storeHours: { orderBy: { dayOfWeek: "asc" } },
      plan: true,
    },
  });
  if (!store) return null;
  if (BLOCKED_STATUSES.includes(store.status)) return null;
  return store;
});

/**
 * Resuelve el slug a partir del storeId. Útil cuando una action tiene el
 * storeId desde la sesión pero necesita el slug para invalidar caches del
 * storefront. Cacheado por request.
 */
export const getStoreSlugById = cache(async (storeId: string): Promise<string> => {
  if (!storeId) return "";
  const s = await db.store.findUnique({
    where: { id: storeId },
    select: { slug: true },
  });
  return s?.slug ?? "";
});
