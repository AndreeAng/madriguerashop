import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DeliveryZonesClient } from "@/components/dashboard/delivery/DeliveryZonesClient";
import { readCircleShape } from "@/lib/delivery/geometry";

export const metadata = { title: "Delivery · Madriguera Shop" };

export default async function DeliveryPage() {
  const { store } = await requireOwnerOnly();

  const zones = await db.deliveryZone.findMany({
    where: { storeId: store.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { orders: true } },
    },
  });

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="mx-auto max-w-4xl p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Cobertura y tarifas
            </p>
            <h1 className="font-display mt-1 text-3xl">Zonas de delivery</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Define cuánto cobras por entregar en cada zona. El cliente
              elige su zona en el checkout y el costo se suma al pedido.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <DeliveryZonesClient
            zones={zones.map((z) => {
              const shape = readCircleShape(z.polygon);
              return {
                id: z.id,
                name: z.name,
                fee: z.fee.toString(),
                estimatedTime: z.estimatedTime ?? "",
                isActive: z.isActive,
                ordersCount: z._count.orders,
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

        <p className="mt-6 text-xs text-[color:var(--muted)]">
          Tip: si una zona ya tuvo pedidos, no se borra — queda como
          inactiva para preservar el historial. Crea una zona nueva con la
          tarifa actualizada si necesitas ajustar precio.
        </p>
      </main>
    </>
  );
}
