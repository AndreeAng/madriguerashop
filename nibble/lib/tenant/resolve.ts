import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Store, StoreStatus } from "@prisma/client";

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
 * Resuelve y valida que la tienda esté visible al público.
 * Lanza 404 si: no existe, está suspendida o cancelada.
 * Permite TRIAL, ACTIVE, PAST_DUE.
 */
export const getPublicStoreBySlug = cache(async (slug: string): Promise<Store> => {
  const store = await getStoreBySlug(slug);

  if (!store) notFound();

  const blockedStatuses: StoreStatus[] = ["SUSPENDED", "CANCELLED"];
  if (blockedStatuses.includes(store.status)) notFound();

  return store;
});

/**
 * Versión que devuelve la store con relaciones útiles para el storefront
 * (template, hours). Solo para páginas server-rendered.
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

  if (!store) notFound();

  const blockedStatuses: StoreStatus[] = ["SUSPENDED", "CANCELLED"];
  if (blockedStatuses.includes(store.status)) notFound();

  return store;
});
