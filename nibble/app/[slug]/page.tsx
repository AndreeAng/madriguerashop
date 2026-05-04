import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Star,
  Clock,
  MapPin,
  ShieldCheck,
  Truck,
  Flame,
  Sparkles,
  ChevronRight,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getStore } from "@/lib/mock/stores";
import { getProductsByStore, categories } from "@/lib/mock/products";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { StorefrontMenu } from "@/components/storefront/StorefrontMenu";
import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { HowItWorks } from "@/components/storefront/HowItWorks";
import { Testimonials } from "@/components/storefront/Testimonials";
import { formatBob } from "@/lib/utils";

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = getStore(slug);
  if (!store) notFound();

  const allProducts = getProductsByStore(slug);
  const featured = allProducts.slice(0, 3);
  const populatedCategories = categories.filter((c) =>
    allProducts.some((p) => p.category === c)
  );
  const productsByCategory = Object.fromEntries(
    populatedCategories.map((c) => [c, allProducts.filter((p) => p.category === c)])
  );

  return (
    <div style={{ ["--store-primary" as string]: store.primaryColor }}>
      <AnnouncementBar />
      <StorefrontHeader store={store} />

      <main
        className="md:pb-16"
        style={{ paddingBottom: "max(8rem, calc(env(safe-area-inset-bottom) + 6rem))" }}
      >
        {/* Hero — cinematic editorial */}
        <section className="relative">
          <div className="relative h-[60vh] min-h-[440px] w-full overflow-hidden md:h-[68vh]">
            <Image
              src={store.bannerImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover scale-[1.02] animate-float"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-bark-900)] via-[color:var(--color-bark-900)]/55 to-[color:var(--color-bark-900)]/20" />
            <div className="absolute inset-0 grain-soft" aria-hidden />

            <div className="absolute inset-0 flex items-end">
              <div className="mx-auto w-full max-w-6xl px-4 pb-12 md:pb-16">
                <div className="reveal-stagger">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                      <span className="relative grid place-items-center">
                        <span className="absolute size-2 animate-pulse-dot rounded-full bg-[color:var(--color-leaf-400)]" />
                        <span className="size-2 rounded-full bg-[color:var(--color-leaf-400)]" />
                      </span>
                      Abierto · cierra a las 23:00
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                      <Star className="size-3 fill-[color:var(--color-amber-300)] text-[color:var(--color-amber-300)]" />
                      <span className="num-tabular">{store.rating}</span>
                      <span className="text-white/60">·</span>
                      <span className="num-tabular">{store.ordersThisMonth}+ pedidos / mes</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                      <Truck className="size-3.5" />
                      Delivery 25–35 min
                    </span>
                  </div>

                  <h1 className="font-display mt-5 text-[42px] leading-[0.95] tracking-tight text-white md:text-7xl">
                    {store.tagline}
                  </h1>
                  <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 md:text-base">
                    {store.description}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <a
                      href="#menu"
                      className="group inline-flex h-12 items-center gap-2 rounded-full bg-[color:var(--color-amber-500)] px-6 text-sm font-semibold text-white shadow-float transition-all duration-200 hover:scale-[1.03] hover:bg-[color:var(--color-amber-600)] active:scale-95"
                    >
                      <Flame className="size-4" />
                      Ver el menú
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                    <a
                      href="#destacados"
                      className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/15"
                    >
                      <Sparkles className="size-4" />
                      Lo más pedido
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip — overlaps the hero edge */}
          <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[color:var(--line-strong)] shadow-soft md:grid-cols-4">
              <TrustItem icon={<Truck className="size-4" />} label="Delivery" hint="25–35 min" />
              <TrustItem icon={<ShieldCheck className="size-4" />} label="Pago seguro" hint="QR · transfer." />
              <TrustItem icon={<Star className="size-4" />} label={`${store.rating} ★ reseñas`} hint="+1.2k clientes" />
              <TrustItem icon={<Clock className="size-4" />} label="Abierto" hint="Hasta 23:00" />
            </div>
          </div>
        </section>

        {/* How it works — trust building between hero and menu */}
        <HowItWorks />

        {/* Sticky nav + Featured + Promo + Catalog (client) */}
        <StorefrontMenu
          store={store}
          featured={featured}
          populatedCategories={populatedCategories}
          productsByCategory={productsByCategory}
          promoSlot={<PromoStrip key="promo-combo" storeSlug={store.slug} />}
        />

        {/* Reviews / social proof */}
        <Testimonials rating={store.rating} ordersThisMonth={store.ordersThisMonth} />

        {/* Restaurant info card with WhatsApp CTA */}
        <section className="mx-auto mt-16 max-w-6xl px-4">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] shadow-soft">
              <div className="grid gap-px bg-[color:var(--line)] sm:grid-cols-3">
                <Detail
                  icon={<Clock className="size-4" />}
                  label="Horario"
                  value="Lun – Dom"
                  hint="11:00 – 23:00"
                />
                <Detail
                  icon={<MapPin className="size-4" />}
                  label="Ubicación"
                  value={store.city}
                  hint="Bolivia · Delivery zona ciudad"
                />
                <Detail
                  icon={<Star className="size-4 fill-current text-[color:var(--color-amber-500)]" />}
                  label="Reputación"
                  value={`${store.rating} de 5`}
                  hint={`${store.ordersThisMonth} pedidos este mes`}
                />
              </div>
            </div>

            {/* WhatsApp CTA card */}
            <div className="relative overflow-hidden rounded-3xl bg-[color:var(--color-leaf-600)] p-6 text-white shadow-soft">
              <div
                aria-hidden
                className="absolute -right-8 -top-8 size-40 rounded-full bg-[color:var(--color-leaf-400)]/30 blur-2xl"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur">
                  <MessageCircle className="size-3" /> Atención directa
                </span>
                <h3 className="font-display mt-3 text-2xl leading-tight">
                  ¿Dudas? Te respondemos en menos de 5 min
                </h3>
                <p className="mt-1.5 text-sm text-white/85">
                  Escribinos al WhatsApp y resolvemos en el momento.
                </p>
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[color:var(--color-leaf-600)] transition hover:scale-[1.03] active:scale-95"
                >
                  <Phone className="size-4" />
                  <span className="num-tabular">{store.whatsapp}</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StorefrontFooter store={store} />

      {/* Floating cart bar (mobile) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-4 md:hidden"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <a
          href={`/${store.slug}/checkout`}
          className="flex h-14 items-center justify-between rounded-full bg-[color:var(--color-bark-900)] px-5 text-white shadow-float"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-full bg-[color:var(--color-amber-500)] text-[12px] font-bold num-tabular text-[color:var(--color-bark-900)]">
              2
            </span>
            Tu pedido
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="num-tabular">{formatBob(96)}</span>
            <ChevronRight className="size-4" />
          </span>
        </a>
      </div>
    </div>
  );
}

function PromoStrip({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="mx-auto mt-12 max-w-6xl px-4">
      <div className="relative overflow-hidden rounded-3xl bg-[color:var(--color-bark-900)] p-6 text-white shadow-float md:p-10">
        <div className="grain-soft" aria-hidden />
        <div className="absolute -right-10 -top-10 size-72 rounded-full bg-[color:var(--color-amber-500)]/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 size-64 rounded-full bg-[color:var(--color-tomato-500)]/20 blur-3xl" />

        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                Combo del día · -20%
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-tomato-500)]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                <Clock className="size-3" /> Termina hoy 21:00
              </span>
            </div>
            <h3 className="font-display mt-3 text-3xl leading-tight md:text-4xl">
              Combo Familiar para <span className="text-[color:var(--color-amber-300)]">cuatro</span>
            </h3>
            <p className="mt-2 max-w-md text-sm text-white/75">
              24 wings + 2 papas cheese + 4 bebidas. Pedilo antes de las 21:00 y te llega caliente.
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display num-tabular text-3xl text-white">{formatBob(145)}</span>
              <span className="text-sm text-white/50 line-through num-tabular">{formatBob(175)}</span>
              <span className="rounded-full bg-[color:var(--color-tomato-500)] px-2 py-0.5 text-[11px] font-bold">
                Ahorrás Bs 30
              </span>
            </div>
          </div>

          <a
            href={`/${storeSlug}/checkout`}
            className="group inline-flex h-12 items-center gap-2 self-start rounded-full bg-white px-6 text-sm font-semibold text-[color:var(--color-bark-900)] transition hover:scale-[1.03] active:scale-95"
          >
            Pedir combo
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function TrustItem({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-[color:var(--card)] p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--color-amber-50)] text-[color:var(--color-amber-700)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight">{label}</p>
        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">{hint}</p>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-4 bg-[color:var(--card)] p-6">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--card-soft)] text-[color:var(--fg-soft)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {label}
        </p>
        <p className="mt-1 font-display text-lg leading-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-[color:var(--muted)]">{hint}</p>}
      </div>
    </div>
  );
}
