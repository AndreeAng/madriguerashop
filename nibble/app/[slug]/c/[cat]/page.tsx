import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
  params: Promise<{ slug: string; cat: string }>;
}) {
  const { slug, cat } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  const category = await db.category.findFirst({
    where: { storeId: store.id, slug: cat, isVisible: true },
    select: { name: true, description: true },
  });
  if (!category) return {};
  return {
    title: `${category.name} · ${store.name}`,
    description:
      category.description ?? `Productos en ${category.name} de ${store.name}.`,
    alternates: { canonical: `/${slug}/c/${cat}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; cat: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug, cat } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const storeData = await getStorefrontData(slug);
  if (!storeData) notFound();

  // Categoría visible que pertenece a esta tienda. Si no existe, 404 — no
  // exponemos categorías privadas ni cross-tenant.
  const category = await db.category.findFirst({
    where: { storeId: storeData.id, slug: cat, isVisible: true },
    select: { id: true, name: true, description: true },
  });
  if (!category) notFound();

  void trackPageView({ storeId: storeData.id, path: `/${slug}/c/${cat}` });

  const where = {
    storeId: storeData.id,
    isActive: true,
    categoryId: category.id,
  };

  const now = new Date();
  const [productsRaw, total, cart] = await Promise.all([
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
  ]);

  const store = toStoreView(storeData, { hours: storeData.storeHours, now });
  const products = productsRaw.map((p) => toProductView(p, slug, now));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) =>
    targetPage > 1
      ? `/${slug}/c/${cat}?page=${targetPage}`
      : `/${slug}/c/${cat}`;

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

        <h1 className="font-display mt-3 text-3xl">{category.name}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          {total} {total === 1 ? "producto" : "productos"}
          {category.description ? ` · ${category.description}` : ""}
        </p>

        <div className="mt-8">
          {products.length === 0 ? (
            <EmptyState description="Aún no hay productos en esta categoría." />
          ) : (
            <ProductGrid store={store} products={products} />
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          itemLabel="producto"
          buildPageHref={buildPageHref}
        />
      </main>

      <StorefrontFooter store={store} />
    </div>
  );
}
