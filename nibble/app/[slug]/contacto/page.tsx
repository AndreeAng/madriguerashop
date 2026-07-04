import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { getStorefrontData, getStoreBySlug } from "@/lib/tenant/resolve";
import { toStoreView } from "@/lib/storefront/adapter";
import { getCartSnapshot } from "@/server/actions/cart";
import { trackPageView } from "@/lib/analytics/track";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { buildWhatsAppUrl, formatWaPhone } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return {
    title: `Contacto · ${store.name}`,
    description: `Cómo contactarte con ${store.name}.`,
    alternates: { canonical: `/${slug}/contacto` },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storeData = await getStorefrontData(slug);
  if (!storeData) notFound();

  void trackPageView({ storeId: storeData.id, path: `/${slug}/contacto` });

  const store = toStoreView(storeData, {
    hours: storeData.storeHours,
    now: new Date(),
  });
  const cart = await getCartSnapshot(slug);

  const waUrl = buildWhatsAppUrl(
    store.whatsapp,
    `Hola, te escribo desde ${store.name}.`,
  );

  // Las redes son opcionales — mostramos solo las que el owner cargó.
  // Se guardan como USUARIO (no URL) — construimos la URL completa igual
  // que el footer; el valor crudo como href sería un link relativo roto.
  const socials = [
    store.instagram
      ? { icon: Instagram, label: "Instagram", href: `https://instagram.com/${store.instagram}` }
      : null,
    store.facebook
      ? { icon: Facebook, label: "Facebook", href: `https://facebook.com/${store.facebook}` }
      : null,
    store.tiktok
      ? { icon: MessageCircle, label: "TikTok", href: `https://tiktok.com/@${store.tiktok}` }
      : null,
    store.website
      ? { icon: Globe, label: "Sitio web", href: store.website }
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div>
      <StorefrontHeader store={store} cartCount={cart?.itemCount ?? 0} />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
          Contacto
        </p>
        <h1 className="font-display mt-2 text-4xl">Hablemos</h1>
        <p className="mt-2 text-[color:var(--muted)]">
          La forma más rápida es WhatsApp.
        </p>

        {store.whatsapp && (
          <Link
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#20BD5A]"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {formatWaPhone(store.whatsapp)}
          </Link>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {store.email && (
            <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="size-4 text-[color:var(--color-amber-600)]" />
                Email
              </div>
              <a
                href={`mailto:${store.email}`}
                className="mt-2 block text-sm hover:underline"
              >
                {store.email}
              </a>
            </section>
          )}

          {store.addressText && (
            <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-4 text-[color:var(--color-amber-600)]" />
                Dirección
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
              Horarios de atención
            </div>
            {store.hoursGroups.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Escríbenos para coordinar.
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

          {socials.length > 0 && (
            <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
              <div className="text-sm font-medium">Síguenos</div>
              <ul className="mt-2 space-y-2 text-sm">
                {socials.map((s) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.label}>
                      <Link
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <Icon className="size-4 text-[color:var(--color-amber-600)]" />
                        {s.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>

      <StorefrontFooter store={store} />
    </div>
  );
}
