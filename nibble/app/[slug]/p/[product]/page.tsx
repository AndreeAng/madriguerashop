import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Minus, Plus, Star, MessageCircle, Clock } from "lucide-react";
import { getStore } from "@/lib/mock/stores";
import { getProduct, getProductsByStore } from "@/lib/mock/products";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { ProductCard } from "@/components/storefront/ProductCard";
import { formatBob } from "@/lib/utils";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product: productSlug } = await params;
  const store = getStore(slug);
  const product = getProduct(slug, productSlug);
  if (!store || !product) notFound();

  const related = getProductsByStore(slug)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  return (
    <div>
      <StorefrontHeader store={store} />

      <nav className="mx-auto max-w-6xl px-4 pt-6 text-sm">
        <Link href={`/${slug}`} className="inline-flex items-center gap-1 text-[color:var(--muted)] hover:text-[color:var(--fg)]">
          <ChevronLeft className="size-4" /> Volver al menú
        </Link>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-[color:var(--card)]">
              <Image src={product.image} alt={product.name} fill priority className="object-cover" />
              {product.badge && product.badgeLabel && (
                <span className="absolute left-4 top-4 rounded-full bg-[color:var(--color-amber-500)] px-3 py-1.5 text-xs font-semibold text-white">
                  {product.badgeLabel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[product.image, product.image, product.image, product.image].map((img, i) => (
                <div key={i} className={`relative aspect-square overflow-hidden rounded-xl border ${i === 0 ? "border-[color:var(--color-bark-900)]" : "border-[color:var(--line)]"}`}>
                  <Image src={img} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">{product.category}</p>
            <h1 className="font-display mt-2 text-4xl">{product.name}</h1>

            {product.rating && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--card)] px-2 py-1">
                  <Star className="size-3.5 fill-current text-[color:var(--color-amber-500)]" />
                  <span className="font-medium">{product.rating}</span>
                </span>
                <span className="text-[color:var(--muted)]">· 87 reseñas</span>
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

            <p className="mt-5 leading-relaxed text-[color:var(--muted)]">{product.description}</p>

            {product.variants && (
              <div className="mt-7">
                <p className="text-sm font-medium">Tamaño</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.variants.map((v, i) => (
                    <button
                      key={v.name}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        i === 1
                          ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                          : "border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
                      }`}
                    >
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs opacity-80">
                        {v.priceDelta === 0
                          ? formatBob(product.price)
                          : v.priceDelta > 0
                          ? `+${formatBob(v.priceDelta)}`
                          : `−${formatBob(Math.abs(v.priceDelta))}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7">
              <p className="text-sm font-medium">Notas para la cocina (opcional)</p>
              <textarea
                rows={2}
                placeholder="Sin cebolla, salsa aparte..."
                className="mt-2 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--card)]">
                <button className="size-10 rounded-full hover:bg-[color:var(--line)]"><Minus className="mx-auto size-4" /></button>
                <span className="w-8 text-center text-sm font-semibold">1</span>
                <button className="size-10 rounded-full hover:bg-[color:var(--line)]"><Plus className="mx-auto size-4" /></button>
              </div>
              <Link
                href={`/${slug}/checkout`}
                className="flex-1 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3 text-center text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
              >
                Agregar — {formatBob(product.price)}
              </Link>
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 text-sm">
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-[color:var(--muted)]" />
                <span>Entrega 30–45 min en {store.city}</span>
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
