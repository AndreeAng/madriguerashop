import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star, MessageCircle, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontData } from "@/lib/tenant/resolve";
import { toStoreView, toProductView } from "@/lib/storefront/adapter";
import { getCartSnapshot } from "@/server/actions/cart";
import { trackPageView } from "@/lib/analytics/track";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductPdpAdd } from "@/components/storefront/ProductPdpAdd";
import { BookingForm } from "@/components/storefront/BookingForm";
import { formatBob } from "@/lib/utils";

const PRODUCT_INCLUDE = {
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: { where: { isActive: true } },
  category: { select: { id: true, name: true, sortOrder: true } },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product: productSlug } = await params;
  const storeData = await getStorefrontData(slug).catch(() => null);
  if (!storeData) return {};

  const product = await db.product.findFirst({
    where: { storeId: storeData.id, slug: productSlug, isActive: true },
    select: {
      name: true,
      description: true,
      shortDescription: true,
      images: {
        take: 1,
        orderBy: { sortOrder: "asc" as const },
        select: { url: true },
      },
    },
  });
  if (!product) return {};

  const description =
    product.shortDescription ||
    product.description?.slice(0, 200) ||
    `Pedí ${product.name} en ${storeData.name}.`;
  const image = product.images[0]?.url;
  const canonical = `/${slug}/p/${productSlug}`;

  return {
    title: `${product.name} · ${storeData.name}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${product.name} · ${storeData.name}`,
      description,
      url: canonical,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: image
      ? { card: "summary_large_image", title: product.name, description, images: [image] }
      : { card: "summary", title: product.name, description },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product: productSlug } = await params;

  const storeData = await getStorefrontData(slug);
  if (!storeData) notFound();

  const productRaw = await db.product.findFirst({
    where: { storeId: storeData.id, slug: productSlug, isActive: true },
    include: PRODUCT_INCLUDE,
  });

  if (!productRaw) notFound();

  // Track visita al detalle (fire-and-forget, no bloqueante)
  void trackPageView({
    storeId: storeData.id,
    path: `/${slug}/p/${productSlug}`,
    productId: productRaw.id,
  });

  const relatedRaw = await db.product.findMany({
    where: {
      storeId: storeData.id,
      isActive: true,
      id: { not: productRaw.id },
      ...(productRaw.categoryId ? { categoryId: productRaw.categoryId } : {}),
    },
    include: PRODUCT_INCLUDE,
    take: 4,
    orderBy: { isFeatured: "desc" },
  });

  // `now` compartido para producto + related: si un producto está al borde
  // de su `availableTo`, su disponibilidad debe ser consistente en toda la
  // página (PDP + grilla de relacionados).
  const now = new Date();
  const store = toStoreView(storeData, { hours: storeData.storeHours, now });
  const product = toProductView(productRaw, slug, now);
  const related = relatedRaw.map((p) => toProductView(p, slug, now));
  const cart = await getCartSnapshot(slug);
  const cartCount = cart?.itemCount ?? 0;

  // Galería: si el producto tiene <2 imágenes, mostramos la principal repetida (compatible con grid)
  const allImages =
    productRaw.images.length > 0
      ? productRaw.images.map((i) => i.url)
      : [product.image];

  return (
    <div>
      <StorefrontHeader store={store} cartCount={cartCount} />

      <nav className="mx-auto max-w-6xl px-4 pt-6 text-sm">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1 text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          <ChevronLeft className="size-4" /> Volver al menú
        </Link>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-[color:var(--card)]">
              <Image
                src={allImages[0] ?? product.image}
                alt={product.name}
                fill
                priority
                className="object-cover"
              />
              {product.badge && product.badgeLabel && (
                <span className="absolute left-4 top-4 rounded-full bg-[color:var(--color-amber-500)] px-3 py-1.5 text-xs font-semibold text-white">
                  {product.badgeLabel}
                </span>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {allImages.slice(0, 4).map((img, i) => (
                  <div
                    key={img + i}
                    className={`relative aspect-square overflow-hidden rounded-xl border ${
                      i === 0
                        ? "border-[color:var(--color-bark-900)]"
                        : "border-[color:var(--line)]"
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
              {product.category}
            </p>
            <h1 className="font-display mt-2 text-4xl">{product.name}</h1>

            {product.rating && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--card)] px-2 py-1">
                  <Star className="size-3.5 fill-current text-[color:var(--color-amber-500)]" />
                  <span className="font-medium">{product.rating}</span>
                </span>
              </div>
            )}

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-display text-4xl">{formatBob(product.price)}</span>
              {product.comparePrice && (
                <span className="text-lg text-[color:var(--muted)] line-through">
                  {formatBob(product.comparePrice)}
                </span>
              )}
            </div>

            <p className="mt-5 leading-relaxed text-[color:var(--muted)]">
              {product.description}
            </p>

            {/* Productos reservables (servicios) usan BookingForm con
                calendario en lugar del "Agregar al carrito" tradicional. */}
            {productRaw.isBookable ? (
              <BookingForm
                productId={productRaw.id}
                productName={productRaw.name}
                storeSlug={slug}
                durationMin={productRaw.bookingDurationMin}
              />
            ) : (
              <ProductPdpAdd
                product={product}
                storeSlug={slug}
                vertical={storeData.vertical}
              />
            )}

            <div className="mt-6 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 text-sm">
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-[color:var(--muted)]" />
                <span>Entrega en {store.city}</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="size-4 text-[color:var(--muted)]" />
                <span>Confirmación por WhatsApp en menos de 5 min</span>
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-2xl">También te puede gustar</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <StorefrontFooter store={store} />
    </div>
  );
}
