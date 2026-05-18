import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TeamClient } from "@/components/dashboard/equipo/TeamClient";

export const metadata = { title: "Equipo · Madriguera Shop" };

export default async function TeamPage() {
  // Owner-only: el cashier mismo no debería ver/editar este panel.
  const { store, user } = await requireOwnerOnly();

  const cashiers = await db.user.findMany({
    where: { storeId: store.id, role: Role.CASHIER },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="mx-auto max-w-3xl p-6 lg:p-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
            Tu equipo
          </p>
          <h1 className="font-display mt-1 text-3xl">Cajeros</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Los cajeros pueden ver pedidos y marcar estados (preparando, en
            entrega, entregado). NO pueden crear/editar productos, ver
            facturación ni cambiar configuración. Tú como dueño guardas
            ese control.
          </p>
        </div>

        <div className="mt-8">
          <TeamClient
            ownerName={user.id /* no se usa, pero recuerda quién está logueado */}
            cashiers={cashiers.map((c) => ({
              id: c.id,
              fullName: c.fullName,
              contact: c.email ?? c.phone ?? "(sin contacto)",
              isActive: c.isActive,
              createdAt: c.createdAt.toISOString(),
              lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
            }))}
          />
        </div>
      </main>
    </>
  );
}
