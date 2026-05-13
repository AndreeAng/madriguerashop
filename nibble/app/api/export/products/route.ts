import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { rowsToCsv, csvFilename } from "@/lib/export/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 10_000;

export async function GET() {
  // Solo owner exporta el catálogo — el cashier no necesita esto.
  const { store } = await requireOwnerOnly();

  const products = await db.product.findMany({
    where: { storeId: store.id },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: MAX_ROWS,
    include: {
      category: { select: { name: true } },
    },
  });

  const headers = [
    "Nombre",
    "Slug",
    "SKU",
    "Categoría",
    "Precio base (Bs)",
    "Precio comparación (Bs)",
    "Stock",
    "Maneja stock",
    "Activo",
    "Destacado",
    "Reservable",
    "Descripción corta",
    "Creado",
    "Actualizado",
  ];

  const rows = products.map((p) => [
    p.name,
    p.slug,
    p.sku ?? "",
    p.category?.name ?? "",
    Number(p.basePrice),
    p.comparePrice != null ? Number(p.comparePrice) : "",
    p.manageStock ? p.stock : "",
    p.manageStock ? "sí" : "no",
    p.isActive ? "sí" : "no",
    p.isFeatured ? "sí" : "no",
    p.isBookable ? "sí" : "no",
    p.shortDescription ?? "",
    p.createdAt,
    p.updatedAt,
  ]);

  const csv = rowsToCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("productos")}"`,
      "Cache-Control": "no-store",
    },
  });
}
