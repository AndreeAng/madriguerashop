import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BannersClient } from "@/components/dashboard/promociones/BannersClient";
import { PopupsClient } from "@/components/dashboard/promociones/PopupsClient";
import { CouponsClient } from "@/components/dashboard/promociones/CouponsClient";
import { PromocionesTabs } from "@/components/dashboard/promociones/PromocionesTabs";

export const metadata = { title: "Promociones · Madriguera Shop" };

export default async function PromocionesPage() {
  const { store } = await requireOwnerOnly();

  // Cargamos los 5 datasets en paralelo. Los 3 principales (banners,
  // popups, coupons) son los datos editables; categories + topProducts
  // alimentan el LinkTargetPicker — el owner elige el destino del banner/
  // popup eligiendo de un dropdown en vez de tipear URLs a mano.
  //
  // `topProducts`: limitamos a 50 ordenados por createdAt — si el catálogo
  // tiene más, el owner siempre tiene la opción "URL personalizada".
  const [banners, popups, coupons, categories, topProducts] = await Promise.all([
    db.banner.findMany({
      where: { storeId: store.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        mobileImageUrl: true,
        linkUrl: true,
        isActive: true,
        validFrom: true,
        validTo: true,
      },
    }),
    db.popup.findMany({
      where: { storeId: store.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        message: true,
        imageUrl: true,
        ctaText: true,
        ctaUrl: true,
        delaySeconds: true,
        showOncePerSession: true,
        isActive: true,
        validFrom: true,
        validTo: true,
      },
    }),
    db.coupon.findMany({
      where: { storeId: store.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrderAmount: true,
        maxDiscountAmount: true,
        usageLimit: true,
        usageLimitPerUser: true,
        usedCount: true,
        validFrom: true,
        validTo: true,
        isActive: true,
      },
    }),
    db.category.findMany({
      where: { storeId: store.id, isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    }),
    db.product.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { slug: true, name: true },
    }),
  ]);

  const pickerContext = {
    storeSlug: store.slug,
    storeWhatsappPhone: store.whatsappPhone,
    categories,
    products: topProducts,
  };

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="mx-auto max-w-4xl p-6 lg:p-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
            Marketing
          </p>
          <h1 className="font-display mt-1 text-3xl">Promociones</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Banners, popups y cupones para activar más ventas. Cada uno se
            usa en momentos distintos — leé la descripción de cada pestaña.
          </p>
        </div>

        <PromocionesTabs
          counts={{
            banners: banners.length,
            popups: popups.length,
            coupons: coupons.length,
          }}
          banners={
            <BannersClient
              banners={banners.map((b) => ({
                id: b.id,
                title: b.title,
                subtitle: b.subtitle,
                imageUrl: b.imageUrl,
                mobileImageUrl: b.mobileImageUrl,
                linkUrl: b.linkUrl,
                isActive: b.isActive,
                validFrom: b.validFrom?.toISOString() ?? null,
                validTo: b.validTo?.toISOString() ?? null,
              }))}
              pickerContext={pickerContext}
            />
          }
          popups={
            <PopupsClient
              popups={popups.map((p) => ({
                id: p.id,
                title: p.title,
                message: p.message,
                imageUrl: p.imageUrl,
                ctaText: p.ctaText,
                ctaUrl: p.ctaUrl,
                delaySeconds: p.delaySeconds,
                showOncePerSession: p.showOncePerSession,
                isActive: p.isActive,
                validFrom: p.validFrom?.toISOString() ?? null,
                validTo: p.validTo?.toISOString() ?? null,
              }))}
              pickerContext={pickerContext}
            />
          }
          coupons={
            <CouponsClient
              coupons={coupons.map((c) => ({
                id: c.id,
                code: c.code,
                description: c.description,
                type: c.type,
                value: c.value.toString(),
                minOrderAmount: c.minOrderAmount?.toString() ?? null,
                maxDiscountAmount: c.maxDiscountAmount?.toString() ?? null,
                usageLimit: c.usageLimit,
                usageLimitPerUser: c.usageLimitPerUser,
                usedCount: c.usedCount,
                validFrom: c.validFrom.toISOString(),
                validTo: c.validTo.toISOString(),
                isActive: c.isActive,
              }))}
            />
          }
        />
      </main>
    </>
  );
}
