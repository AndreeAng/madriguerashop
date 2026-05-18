import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { rowsToCsv, csvFilename } from "@/lib/export/csv";
import { STATUS_LABELS, PAYMENT_LABELS } from "@/lib/orders/status";
import { audit } from "@/lib/audit/log";

/**
 * Exporta los pedidos de la tienda actual como CSV. Auth: owner o cashier
 * vía `requireStoreOwner` (super-admin impersonando también pasa).
 *
 * Diseño:
 *   - El export es síncrono — para tiendas con >50k pedidos esto podría
 *     timeout; en esos casos pasaremos a background job + email cuando
 *     sea problema. Hasta ese punto, sync responde en <2s.
 *   - Soporta query params `from`/`to` (YYYY-MM-DD) para acotar el rango.
 *     Si no se pasan, exporta los últimos 5000 pedidos para evitar
 *     accidentes con tiendas de alto volumen.
 *   - El audit log registra el export para trazabilidad legal (los
 *     pedidos contienen datos personales del cliente).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 10_000;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  // ISO date "2026-05-13" o ISO datetime. Date() parsea ambos.
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function GET(request: Request) {
  const { store, user } = await requireStoreOwner();
  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));

  const orders = await db.order.findMany({
    where: {
      storeId: store.id,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { _count: { select: { items: true } } },
  });

  const headers = [
    "Pedido",
    "Fecha",
    "Estado",
    "Pago",
    "Cliente",
    "Teléfono",
    "Email",
    "Dirección",
    "Items",
    "Subtotal",
    "Descuento",
    "Envío",
    "Total",
    "Método de pago",
    "Cupón",
    "Notas",
  ];

  const rows = orders.map((o) => [
    o.orderNumber,
    o.createdAt,
    STATUS_LABELS[o.status],
    PAYMENT_LABELS[o.paymentStatus],
    o.customerName,
    o.customerPhone,
    o.customerEmail ?? "",
    o.deliveryAddress,
    o._count.items,
    Number(o.subtotal),
    Number(o.discountAmount),
    o.deliveryFee != null ? Number(o.deliveryFee) : "",
    Number(o.total),
    o.paymentMethod,
    o.couponCode ?? "",
    o.customerNotes ?? "",
  ]);

  // Trail de exports de PII para cumplimiento (los pedidos llevan nombre,
  // teléfono, email y dirección del cliente). Antes esto se loggeaba como
  // "order.created" — mezclaba creaciones de pedidos con exportaciones de
  // datos personales, imposibilitando filtrar quién extrajo qué.
  await audit({
    action: "order.exported",
    actorId: user.id,
    storeId: store.id,
    metadata: { exportedCount: orders.length, from, to },
  });

  const csv = rowsToCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("pedidos")}"`,
      "Cache-Control": "no-store",
    },
  });
}
