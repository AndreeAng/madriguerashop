import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CategoriesClient } from "@/components/dashboard/categorias/CategoriesClient";

export const metadata = {
  title: "Categorías · Madriguera Shop",
};

export default async function CategoriesPage() {
  const { store } = await requireOwnerOnly();

  const rows = await db.category.findMany({
    where: { storeId: store.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true, children: true } },
    },
  });

  const categories = rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    parentId: c.parentId,
    imageUrl: c.imageUrl,
    isVisible: c.isVisible,
    productsCount: c._count.products,
    childrenCount: c._count.children,
  }));

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Catálogo
            </p>
            <h1 className="font-display mt-1 text-3xl">Categorías</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Organiza tu menú en grupos. El orden y la visibilidad se reflejan en tu storefront.
            </p>
          </div>
        </div>

        <div className="mt-8 max-w-3xl">
          <CategoriesClient categories={categories} />
        </div>
      </main>
    </>
  );
}
