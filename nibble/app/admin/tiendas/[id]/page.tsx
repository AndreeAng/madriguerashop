import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Settings, UserCircle } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { AdminAssignOwnerForm } from "@/components/admin/tiendas/AdminAssignOwnerForm";
import { adminEnterStoreAction } from "@/server/actions/admin-stores";
import { verticalLabel } from "@/lib/saas/verticals";
import { formatBob } from "@/lib/utils";

export const metadata = { title: "Detalle de tienda · Admin" };

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const store = await db.store.findUnique({
    where: { id },
    include: {
      plan: { select: { name: true, monthlyPriceBob: true } },
      template: { select: { name: true } },
      users: {
        where: { role: Role.STORE_OWNER },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      },
      _count: {
        select: { products: true, categories: true, orders: true },
      },
    },
  });

  if (!store) notFound();

  const activeOwners = store.users.filter((u) => u.isActive);
  const hasOwner = activeOwners.length > 0;

  return (
    <main className="mx-auto max-w-4xl p-6 lg:p-8">
          <Link
            href="/admin/tiendas"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            <ChevronLeft className="size-4" /> Tiendas
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl leading-tight">
                {store.name}
              </h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                <span className="font-mono">/{store.slug}</span> ·{" "}
                {verticalLabel(store.vertical)} · {store.city ?? "Bolivia"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/${store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-2 text-sm hover:border-[color:var(--color-bark-300)]"
              >
                Ver storefront <ExternalLink className="size-3.5" />
              </Link>
              {/* Modo configuración: setea la cookie de impersonation y abre
                  el /dashboard de esta tienda como si fueras owner. Para
                  cargar productos en una demo antes de asignarla a un
                  cliente real. */}
              <form action={adminEnterStoreAction.bind(null, store.id)}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
                >
                  <Settings className="size-3.5" />
                  Configurar como admin
                </button>
              </form>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Stat label="Estado" value={store.status} />
            <Stat label="Productos" value={String(store._count.products)} />
            <Stat label="Categorías" value={String(store._count.categories)} />
            <Stat label="Pedidos" value={String(store._count.orders)} />
          </div>

          {/* Plan */}
          <section className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
              Plan
            </h2>
            <p className="mt-2 font-display text-lg">{store.plan.name}</p>
            <p className="text-sm text-[color:var(--muted)]">
              {formatBob(Number(store.plan.monthlyPriceBob))}/mes ·{" "}
              {store.billingCycle === "YEARLY" ? "anual" : "mensual"}
            </p>
          </section>

          {/* Owner */}
          <section
            className={`mt-6 rounded-3xl border p-5 ${
              hasOwner
                ? "border-[color:var(--line)] bg-[color:var(--card)]"
                : "border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
                Owner
              </h2>
              {!hasOwner && (
                <span className="rounded-full bg-[color:var(--color-amber-500)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Sin owner asignado
                </span>
              )}
            </div>

            {hasOwner ? (
              <>
                <ul className="mt-3 space-y-2">
                  {activeOwners.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 rounded-2xl bg-[color:var(--bg)] p-3"
                    >
                      <UserCircle className="size-8 shrink-0 text-[color:var(--muted)]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {u.fullName ?? "(sin nombre)"}
                        </p>
                        <p className="truncate text-xs text-[color:var(--muted)]">
                          {u.email ?? u.phone ?? "(sin contacto)"}
                        </p>
                      </div>
                      <span className="text-[10px] text-[color:var(--muted)]">
                        Desde {u.createdAt.toLocaleDateString("es-BO")}
                      </span>
                    </li>
                  ))}
                </ul>

                <details className="mt-4 rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--bg)] p-3 text-sm">
                  <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
                    Transferir tienda a otro owner
                  </summary>
                  <p className="mt-2 text-xs text-[color:var(--fg-soft)]">
                    Suspende al owner actual y crea uno nuevo. La tienda
                    queda con su catálogo intacto, bajo control del nuevo
                    dueño. El owner suspendido queda en histórico (no se
                    borra) por trazabilidad.
                  </p>
                  <AdminAssignOwnerForm storeId={store.id} mode="transfer" />
                </details>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-[color:var(--fg-soft)]">
                  Esta tienda existe pero todavía no tiene dueño. Asignale uno
                  cuando el cliente confirme — la tienda y todo su catálogo
                  pasan a estar bajo su control.
                </p>
                <AdminAssignOwnerForm storeId={store.id} mode="assign" />
              </>
            )}
          </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-1 num-tabular text-xl font-semibold">{value}</p>
    </div>
  );
}
