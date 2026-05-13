import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ProductsTable } from "@/components/dashboard/productos/ProductsTable";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = {
  title: "Productos · Madriguera Shop",
};

const PAGE_SIZE = 50;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { store } = await requireOwnerOnly();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    storeId: store.id,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { sku: { contains: q, mode: "insensitive" as const } },
            { slug: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [products, total, activeCount] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        category: { select: { name: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
    db.product.count({ where: { storeId: store.id, isActive: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/dashboard/productos${qs ? `?${qs}` : ""}`;
  };

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    basePrice: p.basePrice.toString(),
    comparePrice: p.comparePrice?.toString() ?? null,
    imageUrl: p.images[0]?.url ?? null,
    categoryName: p.category?.name ?? null,
    isActive: p.isActive,
    manageStock: p.manageStock,
    stock: p.stock,
    lowStockAlert: p.lowStockAlert,
  }));

  return (
    <>
      <DashboardHeader
        storeSlug={store.slug}
        leftSlot={
          <form action="/dashboard/productos" className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre o SKU"
              className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
            />
          </form>
        }
      />

      <main className="p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Catálogo
              </p>
              <h1 className="font-display mt-1 text-3xl">Productos</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {total} {total === 1 ? "producto" : "productos"} ·{" "}
                {activeCount} activos
                {q && (
                  <span className="ml-1.5 text-[color:var(--color-amber-600)]">
                    · filtrado por &ldquo;{q}&rdquo;
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Download endpoint: `<a>` con full reload, NO `<Link>`. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/export/products"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--bg)]"
              >
                ↓ Exportar CSV
              </a>
              <Link
                href="/dashboard/productos/importar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--bg)]"
              >
                ↑ Importar CSV
              </Link>
              <Link
                href="/dashboard/productos/nuevo"
                className="press inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
              >
                <Plus className="size-4" />
                Nuevo producto
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <ProductsTable rows={rows} />
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="producto"
            buildPageHref={buildPageHref}
          />
      </main>
    </>
  );
}
