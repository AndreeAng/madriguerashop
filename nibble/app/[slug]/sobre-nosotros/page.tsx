import { notFound } from "next/navigation";
import { Clock, MapPin, Sparkles } from "lucide-react";
import { getStorefrontData, getStoreBySlug } from "@/lib/tenant/resolve";
import { toStoreView } from "@/lib/storefront/adapter";
import { storefrontCopy } from "@/lib/storefront/copy";
import { getCartSnapshot } from "@/server/actions/cart";
import { trackPageView } from "@/lib/analytics/track";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return {
    title: `Sobre nosotros · ${store.name}`,
    description: store.description ?? `Conocé a ${store.name}.`,
    alternates: { canonical: `/${slug}/sobre-nosotros` },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storeData = await getStorefrontData(slug);
  if (!storeData) notFound();

  // Tracking server-side (fire-and-forget).
  void trackPageView({ storeId: storeData.id, path: `/${slug}/sobre-nosotros` });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [ordersThisMonth, cart] = await Promise.all([
    db.order.count({
      where: { storeId: storeData.id, createdAt: { gte: monthStart } },
    }),
    getCartSnapshot(slug),
  ]);

  const store = toStoreView(storeData, {
    hours: storeData.storeHours,
    ordersThisMonth,
    now,
  });

  return (
    <div>
      <StorefrontHeader store={store} cartCount={cart?.itemCount ?? 0} />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
          Sobre {store.name}
        </p>
        <h1 className="font-display mt-2 text-4xl">{store.tagline}</h1>

        <div className="mt-8 space-y-6 text-[color:var(--fg-soft)]">
          <p className="text-lg leading-relaxed">{store.description}</p>

          {store.ordersThisMonth !== undefined && store.ordersThisMonth > 0 && (
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-[color:var(--color-amber-500)]" />
                <span className="font-medium">
                  {store.ordersThisMonth}{" "}
                  {(() => {
                    const c = storefrontCopy(store.vertical);
                    return store.ordersThisMonth === 1 ? c.orderSingular : c.orderPlural;
                  })()}{" "}
                  este mes
                </span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Gracias a cada cliente que confía en nosotros.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {store.addressText && (
            <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-4 text-[color:var(--color-amber-600)]" />
                Dónde encontrarnos
              </div>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {store.addressText}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">{store.city}</p>
            </section>
          )}

          <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-[color:var(--color-amber-600)]" />
              Horarios
            </div>
            {store.hoursGroups.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Consultanos por WhatsApp.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {store.hoursGroups.map((g) => (
                  <li key={`${g.days}-${g.time}`} className="flex justify-between gap-3">
                    <span className="text-[color:var(--muted)]">{g.days}</span>
                    <span className="num-tabular">{g.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <StorefrontFooter store={store} />
    </div>
  );
}
