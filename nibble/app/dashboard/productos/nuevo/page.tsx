import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { ProductForm } from "@/components/dashboard/productos/ProductForm";

export const metadata = {
  title: "Nuevo producto · Madriguera Shop",
};

export default async function NewProductPage() {
  const { store } = await requireOwnerOnly();
  const categories = await db.category.findMany({
    where: { storeId: store.id, isVisible: true },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link
        href="/dashboard/productos"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
      >
        <ChevronLeft className="size-4" /> Productos
      </Link>

      <h1 className="font-display mt-3 text-3xl">Nuevo producto</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Llena lo básico y publícalo. Puedes volver a editarlo cuando quieras.
      </p>

      <div className="mt-8">
        <ProductForm categories={categories} />
      </div>
    </main>
  );
}
