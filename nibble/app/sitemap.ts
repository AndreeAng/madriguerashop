import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

/**
 * Sitemap dinámico — incluye:
 *  - Páginas estáticas del marketing
 *  - Tiendas públicas listadas
 *  - Páginas legales
 *
 * Excluye páginas autenticadas (/dashboard/*, /admin/*) y storefronts privados.
 */

// Lee de DB → render por request, no SSG en build
export const dynamic = "force-dynamic";

function appUrl(): string {
  // `||` para que un APP_URL="" caiga al default — `??` lo dejaría vacío
  // y el sitemap se llenaría con URLs relativas inválidas.
  return (process.env.APP_URL || "https://madrigueras.shop").replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const now = new Date();

  // Estáticas
  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/tiendas`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  // Tiendas públicas + sus productos activos
  let stores: { slug: string; updatedAt: Date }[] = [];
  let products: { slug: string; storeSlug: string; updatedAt: Date }[] = [];
  try {
    stores = await db.store.findMany({
      where: {
        isPubliclyListed: true,
        status: { in: ["ACTIVE", "PAST_DUE"] },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });

    products = (
      await db.product.findMany({
        where: {
          isActive: true,
          store: { isPubliclyListed: true, status: { in: ["ACTIVE", "PAST_DUE"] } },
        },
        select: { slug: true, updatedAt: true, store: { select: { slug: true } } },
        take: 5000,
      })
    ).map((p) => ({ slug: p.slug, storeSlug: p.store.slug, updatedAt: p.updatedAt }));
  } catch {
    // Sin DB en build → caemos a sólo estáticas
  }

  const storePaths: MetadataRoute.Sitemap = stores.flatMap((s) => [
    {
      url: `${base}/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${base}/${s.slug}/sobre-nosotros`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${base}/${s.slug}/contacto`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ]);

  const productPaths: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/${p.storeSlug}/p/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPaths, ...storePaths, ...productPaths];
}
