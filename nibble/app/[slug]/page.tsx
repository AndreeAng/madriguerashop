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
import { db } from "@/lib/db";
import { getStorefrontData, getStoreBySlug } from "@/lib/tenant/resolve";
import { toStoreView, toProductView } from "@/lib/storefront/adapter";
import { getCartSnapshot } from "@/server/actions/cart";
import { trackPageView } from "@/lib/analytics/track";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { StorefrontMenu } from "@/components/storefront/StorefrontMenu";
import { StorefrontBanner } from "@/components/storefront/StorefrontBanner";
import { StorefrontPopup } from "@/components/storefront/StorefrontPopup";
import { ClosedStoreNotice } from "@/components/storefront/ClosedStoreNotice";
import { formatBob } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // getStoreBySlug está cacheada con React.cache → si la usamos también en
  // la page, comparte una sola query por render.
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return {
    title: store.metaTitle ?? `${store.name}${store.city ? ` · ${store.city}` : ""}`,
    description: store.metaDescription ?? store.description ?? `Pedí en línea de ${store.name}.`,
    openGraph: store.ogImageUrl ? { images: [store.ogImageUrl] } : undefined,
    alternates: { canonical: `/${slug}` },
  };
}

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 1. Load store with template + hours + plan (via cached helper)
  const storeData = await getStorefrontData(slug);
  // `getStorefrontData` ahora devuelve null en vez de llamar `notFound()`
  // internamente — eso restaura el status 404 real (importante para SEO,
  // sino Google podría indexar slugs inexistentes como páginas válidas).
  if (!storeData) notFound();

  // Tracking de visita (fire-and-forget, no bloquea el render)
  void trackPageView({ storeId: storeData.id, path: `/${slug}` });

  // 2-3. Productos + orders del mes + cart son independientes — corren en
  // paralelo. Antes `productsRaw` se await-eaba antes que el Promise.all,
  // bloqueando el TTFB innecesariamente.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [productsRaw, ordersThisMonth, cart, activeBanner, activePopup] =
    await Promise.all([
    db.product.findMany({
      where: { storeId: storeData.id, isActive: true },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { where: { isActive: true } },
        category: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    }),
    db.order.count({
      where: { storeId: storeData.id, createdAt: { gte: monthStart } },
    }),
    getCartSnapshot(slug),
    // Banner activo "ahora": filtra por isActive + dentro de la ventana
    // validFrom/validTo. Si hay varios cumpliendo, toma el de menor
    // sortOrder. Si no hay, devuelve null y el storefront no renderiza
    // sección de promo.
    db.banner.findFirst({
      where: {
        storeId: storeData.id,
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        imageUrl: true,
        mobileImageUrl: true,
        title: true,
        subtitle: true,
        linkUrl: true,
      },
    }),
    // Popup activo "ahora": misma lógica de ventana que banner, pero
    // sólo uno se muestra a la vez (el más reciente). Solo lo bajamos
    // si hay alguno — si no, no renderizamos el componente client.
    db.popup.findFirst({
      where: {
        storeId: storeData.id,
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        message: true,
        imageUrl: true,
        ctaText: true,
        ctaUrl: true,
        delaySeconds: true,
        showOncePerSession: true,
      },
    }),
  ]);
  const cartCount = cart?.itemCount ?? 0;
  const cartSubtotal = cart?.subtotal ?? 0;

  // 4. Build view models
  const store = toStoreView(storeData, {
    hours: storeData.storeHours,
    ordersThisMonth,
    now,
  });

  // `now` compartido para todos los toProductView de este render: evita que
  // un producto en el límite de su `availableTo` aparezca/desaparezca entre
  // calls que ocurren en el mismo segundo.
  const allProducts = productsRaw.map((p) => toProductView(p, slug, now));

  // 5. Group by category, preserve order from Category.sortOrder
  const categoryOrder = new Map<string, number>();
  for (const p of productsRaw) {
    if (p.category) {
      categoryOrder.set(p.category.name, p.category.sortOrder);
    }
  }
  const populatedCategories = Array.from(categoryOrder.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  const productsByCategory = Object.fromEntries(
    populatedCategories.map((c) => [c, allProducts.filter((p) => p.category === c)]),
  );

  // Destacados: solo productos que el owner marcó explícitamente como
  // `isFeatured`. Antes se mostraban los primeros 3 sin filtrar, lo que
  // hacía que cualquier tienda nueva (sin destacados) mostrara productos
  // arbitrarios como "Imperdibles".
  const featured = productsRaw
    .filter((p) => p.isFeatured)
    .slice(0, 3)
    .map((p) => toProductView(p, slug, now));

  return (
    <div style={{ ["--store-primary" as string]: store.primaryColor }}>
      <StorefrontHeader store={store} cartCount={cartCount} />

      <main
        className="md:pb-16"
        style={{ paddingBottom: "max(8rem, calc(env(safe-area-inset-bottom) + 6rem))" }}
      >
        {/* Hero */}
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
                    {store.isOpenNow ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                        <span className="relative grid place-items-center">
                          <span className="absolute size-2 animate-pulse-dot rounded-full bg-[color:var(--color-leaf-400)]" />
                          <span className="size-2 rounded-full bg-[color:var(--color-leaf-400)]" />
                        </span>
                        Abierto · cierra a las {store.closesTodayAt}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                        <span className="size-2 rounded-full bg-white/40" aria-hidden />
                        {store.nextOpeningLabel ?? "Cerrado"}
                      </span>
                    )}
                    {store.ordersThisMonth !== undefined && store.ordersThisMonth > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                        <Star className="size-3 fill-[color:var(--color-amber-300)] text-[color:var(--color-amber-300)]" />
                        <span className="num-tabular">{store.ordersThisMonth}+ pedidos / mes</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                      <Truck className="size-3.5" />
                      Delivery
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
                    {featured.length > 0 && (
                      <a
                        href="#destacados"
                        className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/15"
                      >
                        <Sparkles className="size-4" />
                        Lo más pedido
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[color:var(--line-strong)] shadow-soft md:grid-cols-4">
              <TrustItem icon={<Truck className="size-4" />} label="Delivery" hint={store.city} />
              <TrustItem
                icon={<ShieldCheck className="size-4" />}
                label="Pago seguro"
                hint={
                  store.acceptsQR && store.acceptsCashOnDelivery
                    ? "QR · efectivo"
                    : store.acceptsQR
                      ? "QR del banco"
                      : "Efectivo"
                }
              />
              <TrustItem
                icon={<MapPin className="size-4" />}
                label={store.city}
                hint={store.addressText ?? "Bolivia"}
              />
              <TrustItem
                icon={<Clock className="size-4" />}
                label={store.isOpenNow ? "Abierto" : "Cerrado"}
                hint={
                  store.isOpenNow
                    ? store.closesTodayAt
                      ? `Hasta ${store.closesTodayAt}`
                      : "Ahora"
                    : (store.nextOpeningLabel ?? "Vuelve pronto")
                }
              />
            </div>
          </div>
        </section>

        {/* Banner promocional activo (si el owner configuró uno en
            /dashboard/promociones y está dentro de su ventana de fechas). */}
        {activeBanner && (
          <section className="mx-auto mt-8 max-w-6xl px-4">
            <StorefrontBanner
              imageUrl={activeBanner.imageUrl}
              mobileImageUrl={activeBanner.mobileImageUrl}
              title={activeBanner.title}
              subtitle={activeBanner.subtitle}
              linkUrl={activeBanner.linkUrl}
            />
          </section>
        )}

        {allProducts.length > 0 ? (
          <StorefrontMenu
            store={store}
            featured={featured}
            populatedCategories={populatedCategories}
            productsByCategory={productsByCategory}
          />
        ) : (
          <EmptyMenu storeName={store.name} whatsapp={store.whatsapp} />
        )}

        {/* Contact card with WhatsApp CTA */}
        <section className="mx-auto mt-16 max-w-6xl px-4">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] shadow-soft">
              <div className="grid gap-px bg-[color:var(--line)] sm:grid-cols-3">
                <HoursDetail
                  icon={<Clock className="size-4" />}
                  groups={store.hoursGroups}
                  isOpenNow={store.isOpenNow}
                  closesTodayAt={store.closesTodayAt}
                  nextOpeningLabel={store.nextOpeningLabel}
                />
                <Detail
                  icon={<MapPin className="size-4" />}
                  label="Ubicación"
                  value={store.city}
                  hint={store.addressText ?? "Bolivia"}
                />
                <Detail
                  icon={<MessageCircle className="size-4" />}
                  label="Contacto"
                  value={store.whatsapp}
                  hint="WhatsApp"
                />
              </div>
            </div>

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
                  Escríbenos al WhatsApp y resolvemos en el momento.
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

      {/* Aviso automático "tienda cerrada" — solo si está fuera de horario.
          Tiene precedencia visual sobre el popup promocional porque le da
          al cliente la info crítica (no puedes comprar AHORA) y la CTA
          "programar pedido". */}
      {!store.isOpenNow && (
        <ClosedStoreNotice
          store={{
            name: store.name,
            isOpenNow: store.isOpenNow,
            nextOpeningLabel: store.nextOpeningLabel,
            whatsapp: store.whatsapp,
            slug: store.slug,
          }}
          hours={storeData.storeHours.map((h) => ({
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed,
          }))}
        />
      )}

      {/* Popup promocional (si hay uno activo en la ventana). Lo renderizamos
          al final del DOM para que el z-index sea predecible y no quede
          tapado por el sidebar/header. El componente client decide el
          momento de mostrarse (delaySeconds + once-per-session). */}
      {activePopup && (
        <StorefrontPopup
          popupId={activePopup.id}
          title={activePopup.title}
          message={activePopup.message}
          imageUrl={activePopup.imageUrl}
          ctaText={activePopup.ctaText}
          ctaUrl={activePopup.ctaUrl}
          delaySeconds={activePopup.delaySeconds}
          showOncePerSession={activePopup.showOncePerSession}
        />
      )}

      {/* Floating cart bar (mobile) — sólo cuando hay items */}
      {cartCount > 0 && (
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
                {cartCount}
              </span>
              Tu pedido
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className="num-tabular">{formatBob(cartSubtotal)}</span>
              <ChevronRight className="size-4" />
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

function EmptyMenu({ storeName, whatsapp }: { storeName: string; whatsapp: string }) {
  return (
    <section className="mx-auto mt-16 max-w-3xl px-4">
      <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-10 text-center">
        <h2 className="font-display text-2xl">Estamos preparando el catálogo</h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          {storeName} está cargando sus productos. Mientras tanto, puedes escribirnos por WhatsApp y atenderte directo.
        </p>
        <a
          href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white"
        >
          <MessageCircle className="size-4" />
          Hablar por WhatsApp
        </a>
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
        <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">{hint}</p>
      </div>
    </div>
  );
}

/**
 * Card de detalle en el strip de contacto. Layout vertical (icon arriba,
 * eyebrow, contenido) — antes era horizontal pero el icon competía con
 * el contenido por el ancho del card (~250px) y el horario se quebraba
 * feo. Vertical libera todo el ancho para texto y hace que los 3 cards
 * se sientan simétricos sin importar cuánto contenido tenga cada uno.
 */
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
    <div className="flex flex-col bg-[color:var(--card)] p-5">
      <div className="grid size-10 place-items-center rounded-xl bg-[color:var(--card-soft)] text-[color:var(--fg-soft)]">
        {icon}
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-1.5 font-display text-lg leading-tight">{value}</p>
      {hint && (
        <p className="mt-1 text-xs leading-snug text-[color:var(--muted)]">{hint}</p>
      )}
    </div>
  );
}

/**
 * Detalle de horario. Comparte el layout vertical con `Detail` para que
 * los 3 cards del strip se alineen visualmente. Cada grupo se renderiza
 * en 2 líneas (días arriba, hora abajo) en vez de side-by-side — así
 * los strings nunca compiten por ancho y se evita el line-break del
 * primer intento ("09:00 –" en una línea, "19:00" en otra).
 *
 * El indicador de estado abajo es texto + dot (no pill). Más sutil,
 * coherente con la estética del resto de la página.
 */
function HoursDetail({
  icon,
  groups,
  isOpenNow,
  closesTodayAt,
  nextOpeningLabel,
}: {
  icon: React.ReactNode;
  groups: Array<{ days: string; time: string }>;
  isOpenNow: boolean;
  closesTodayAt: string | null;
  nextOpeningLabel: string | null;
}) {
  const hasSchedule = groups.length > 0;

  return (
    <div className="flex flex-col bg-[color:var(--card)] p-5">
      <div className="grid size-10 place-items-center rounded-xl bg-[color:var(--card-soft)] text-[color:var(--fg-soft)]">
        {icon}
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        Horario
      </p>

      {hasSchedule ? (
        <ul className="mt-1.5 space-y-2">
          {groups.map((g) => (
            <li key={`${g.days}-${g.time}`}>
              <p className="font-display text-lg leading-tight">{g.days}</p>
              <p className="mt-0.5 num-tabular text-xs text-[color:var(--muted)]">
                {g.time}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-[color:var(--muted)]">
          Sin horario configurado
        </p>
      )}

      {hasSchedule && (
        <p
          className={`mt-3 inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium ${
            isOpenNow
              ? "text-[color:var(--color-leaf-700)]"
              : "text-[color:var(--muted)]"
          }`}
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${
              isOpenNow
                ? "bg-[color:var(--color-leaf-500)]"
                : "bg-[color:var(--muted)]"
            }`}
          />
          <span>
            {isOpenNow
              ? `Abierto hasta las ${closesTodayAt}`
              : (nextOpeningLabel ?? "Cerrado")}
          </span>
        </p>
      )}
    </div>
  );
}
