import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";

/**
 * Endpoint de polling para el badge "tenés pedidos para atender" del
 * dashboard. Devuelve contadores ligeros — 2 queries, ambas con índices.
 *
 * Diseño:
 *   - El cliente lo llama cada N segundos. NO usamos SSE porque las
 *     connections persistentes no juegan bien con serverless (Vercel
 *     timeouts a 25s), y para 100-500 owners online simultáneos el
 *     overhead de polling es despreciable.
 *   - `latestOrderId` y `latestOrderAt` permiten al cliente detectar
 *     que llegó un pedido NUEVO desde el último poll y reproducir
 *     sonido. El cliente compara contra su last-seen local.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { store } = await requireStoreOwner();

  const [activeCount, awaitingCount, latestOrder] = await Promise.all([
    db.order.count({
      where: {
        storeId: store.id,
        status: { in: ["NEW", "CONFIRMED", "PREPARING", "IN_DELIVERY"] },
      },
    }),
    db.order.count({
      where: { storeId: store.id, paymentStatus: "AWAITING_VERIFICATION" },
    }),
    db.order.findFirst({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, orderNumber: true },
    }),
  ]);

  return NextResponse.json(
    {
      activeCount,
      awaitingCount,
      latestOrderId: latestOrder?.id ?? null,
      latestOrderAt: latestOrder?.createdAt.toISOString() ?? null,
      latestOrderNumber: latestOrder?.orderNumber ?? null,
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
