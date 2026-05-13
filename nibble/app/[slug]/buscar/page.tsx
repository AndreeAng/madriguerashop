import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontData, getStoreBySlug } from "@/lib/tenant/resolve";
import { toStoreView, toProductView } from "@/lib/storefront/adapter";
import { getCartSnapshot } from "@/server/actions/cart";
import { trackPageView } from "@/lib/analytics/track";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return {
    title: `Buscar · ${store.name}`,
    // No queremos que motores indexen búsquedas — solo el home y los listados.
    robots: { index: false, follow: true },
    alternates: { canonical: `/${slug}/buscar` },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const storeData = await getStorefrontData(slug);
  if (!storeData) notFound();

  void trackPageView({
    storeId: storeData.id,
    path: `/${slug}/buscar${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  });

  // Búsqueda case-insensitive en nombre, descripción y SKU. Cuando el
  // catálogo crezca >5000 productos por tienda, vale pasar a Postgres
  // tsvector + GIN (`@@@` con plainto_tsquery) — pero hasta ~1k productos
  // el `ILIKE` con índice prefix sirve bien.
  const where = q
    ? {
        storeId: storeData.id,
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { shortDescription: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
          { sku: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { storeId: storeData.id, isActive: true };

  const now = new Date();
  const [productsRaw, total, cart] = q
    ? await Promise.all([
        db.product.findMany({
          where,
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            variants: { where: { isActive: true } },
            category: { select: { id: true, name: true, sortOrder: true } },
          },
          orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        db.product.count({ where }),
        getCartSnapshot(slug),
      ])
    : [[], 0, await getCartSnapshot(slug)];

  const store = toStoreView(storeData, { hours: storeData.storeHours, now });
  const products = productsRaw.map((p) => toProductView(p, slug, now));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/${slug}/buscar${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <StorefrontHeader store={store} cartCount={cart?.itemCount ?? 0} />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1 text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          <ChevronLeft className="size-3.5" />
          Volver al menú
        </Link>

        {/* Search form (GET para que la URL refleje la búsqueda y sea
            bookmarkeable / compartible / cacheable). */}
        <form
          action={`/${slug}/buscar`}
          method="get"
          className="mt-4 flex items-center gap-2 rounded-full border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2"
        >
          <Search className="size-4 text-[color:var(--muted)]" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder={`Buscar en ${store.name}…`}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
          />
          <button
            type="submit"
            className="rounded-full bg-[color:var(--color-bark-900)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--color-bark-700)]"
          >
            Buscar
          </button>
        </form>

        <div className="mt-6">
          <h1 className="font-display text-2xl">
            {q ? `Resultados para "${q}"` : "Buscá un producto"}
          </h1>
          {q && (
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {total} {total === 1 ? "resultado" : "resultados"}
            </p>
          )}
        </div>

        <div className="mt-6">
          {!q ? (
            <EmptyState
              icon={<Search className="size-8" />}
              description="Escribí qué buscás en el cuadro de arriba — buscamos en nombre, descripción y código de producto."
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Search className="size-8" />}
              description={`No encontramos productos que coincidan con "${q}".`}
            />
          ) : (
            <ProductGrid store={store} products={products} />
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          itemLabel="resultado"
          buildPageHref={buildPageHref}
        />
      </main>

      <StorefrontFooter store={store} />
    </div>
  );
}
