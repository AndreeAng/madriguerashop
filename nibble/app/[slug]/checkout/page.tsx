import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontData, getStoreBySlug } from "@/lib/tenant/resolve";
import { toStoreView } from "@/lib/storefront/adapter";
import { getCartSnapshot } from "@/server/actions/cart";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";
import { readCircleShape } from "@/lib/delivery/geometry";

// Página privada (carrito personal). No queremos que Google la indexe ni que
// se comparta con preview.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  return {
    title: store ? `Finalizar pedido · ${store.name}` : "Finalizar pedido",
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storeData = await getStorefrontData(slug);
  const store = toStoreView(storeData, { hours: storeData.storeHours });

  const cart = await getCartSnapshot(slug);
  if (!cart || cart.items.length === 0) {
    // Carrito vacío → de vuelta al menú
    redirect(`/${slug}`);
  }

  // Zonas de delivery activas. Traemos el `polygon` para auto-resolver
  // la zona del cliente desde su pin en el mapa, sin que tenga que
  // elegirla a mano.
  const zones = await db.deliveryZone.findMany({
    where: { storeId: storeData.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      fee: true,
      estimatedTime: true,
      polygon: true,
    },
  });

  return (
    <div>
      <StorefrontHeader store={store} cartCount={cart.itemCount} />

      <nav className="mx-auto max-w-6xl px-4 pt-6 text-sm">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1 text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          <ChevronLeft className="size-4" /> Seguir comprando
        </Link>
      </nav>

      <CheckoutForm
        slug={slug}
        store={{
          name: store.name,
          city: store.city,
          vertical: storeData.vertical,
          acceptsQR: store.acceptsQR,
          acceptsCashOnDelivery: store.acceptsCashOnDelivery,
          deliveryEnabled: storeData.deliveryEnabled,
          pickupEnabled: storeData.pickupEnabled,
          defaultDeliveryFee: storeData.defaultDeliveryFee
            ? Number(storeData.defaultDeliveryFee)
            : null,
          freeDeliveryAbove: storeData.freeDeliveryAbove
            ? Number(storeData.freeDeliveryAbove)
            : null,
          deliveryNote: storeData.deliveryNote,
          qrImageUrl: storeData.qrImageUrl,
          qrInstructions: storeData.qrInstructions,
          isOpenNow: store.isOpenNow,
          nextOpeningLabel: store.nextOpeningLabel,
        }}
        hoursByDay={storeData.storeHours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        }))}
        cart={cart}
        deliveryZones={zones.map((z) => {
          const shape = readCircleShape(z.polygon);
          return {
            id: z.id,
            name: z.name,
            fee: Number(z.fee),
            estimatedTime: z.estimatedTime,
            shape: shape
              ? {
                  lat: shape.lat,
                  lng: shape.lng,
                  radiusMeters: shape.radiusMeters,
                }
              : null,
          };
        })}
      />
    </div>
  );
}
