import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { rowsToCsv, csvFilename } from "@/lib/export/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 10_000;

export async function GET() {
  const { store } = await requireStoreOwner();

  const customers = await db.customer.findMany({
    where: { storeId: store.id },
    orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
    take: MAX_ROWS,
  });

  const headers = [
    "Nombre",
    "Teléfono",
    "Email",
    "Pedidos",
    "Total gastado (Bs)",
    "Última dirección",
    "Última nota",
    "Primer pedido",
    "Último pedido",
  ];

  const rows = customers.map((c) => [
    c.fullName,
    c.phone,
    c.email ?? "",
    c.ordersCount,
    Number(c.totalSpent),
    c.lastAddressText ?? "",
    c.lastNote ?? "",
    c.createdAt,
    c.lastOrderAt ?? "",
  ]);

  const csv = rowsToCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("clientes")}"`,
      "Cache-Control": "no-store",
    },
  });
}
