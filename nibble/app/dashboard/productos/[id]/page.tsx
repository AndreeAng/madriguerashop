import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { ProductForm } from "@/components/dashboard/productos/ProductForm";

export const metadata = {
  title: "Editar producto · Madriguera Shop",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { store } = await requireOwnerOnly();
  const { id } = await params;

  const productRaw = await db.product.findFirst({
    where: { id, storeId: store.id },
    include: {
      images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
      variants: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          manageStock: true,
          stock: true,
        },
      },
    },
  });

  if (!productRaw) notFound();

  const categories = await db.category.findMany({
    where: { storeId: store.id, isVisible: true },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Decimal → string para el cliente
  const product = {
    id: productRaw.id,
    name: productRaw.name,
    slug: productRaw.slug,
    description: productRaw.description,
    shortDescription: productRaw.shortDescription,
    sku: productRaw.sku,
    manageStock: productRaw.manageStock,
    stock: productRaw.stock,
    lowStockAlert: productRaw.lowStockAlert,
    isActive: productRaw.isActive,
    isFeatured: productRaw.isFeatured,
    isNew: productRaw.isNew,
    isBestSeller: productRaw.isBestSeller,
    customLabel: productRaw.customLabel,
    categoryId: productRaw.categoryId,
    hasSchedule: productRaw.hasSchedule,
    availableFrom: productRaw.availableFrom,
    availableTo: productRaw.availableTo,
    availableDays: productRaw.availableDays,
    isBookable: productRaw.isBookable,
    bookingDurationMin: productRaw.bookingDurationMin,
    bookingBufferMin: productRaw.bookingBufferMin,
    basePrice: productRaw.basePrice.toString(),
    comparePrice: productRaw.comparePrice?.toString() ?? null,
    images: productRaw.images.map((i) => ({ url: i.url, alt: i.alt })),
    variants: productRaw.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.price ? v.price.toString() : null,
      manageStock: v.manageStock,
      stock: v.stock,
    })),
  };

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link
        href="/dashboard/productos"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
      >
        <ChevronLeft className="size-4" /> Productos
      </Link>

      <h1 className="font-display mt-3 text-3xl">{productRaw.name}</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Última actualización: {productRaw.updatedAt.toLocaleString("es-BO")}
      </p>

      <div className="mt-8">
        <ProductForm product={product} categories={categories} />
      </div>
    </main>
  );
}
