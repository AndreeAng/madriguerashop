import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { AdminCreateStoreForm } from "@/components/admin/tiendas/AdminCreateStoreForm";
import { VERTICAL_LABELS } from "@/lib/saas/verticals";
import { formatBob } from "@/lib/utils";

export const metadata = { title: "Nueva tienda · Admin" };

export default async function AdminNewStorePage() {
  await requireSuperAdmin();

  // Planes activos para el select. Si no hay ninguno, el form mostrará el
  // error "Plan no encontrado" al submit — pero acá podríamos mostrar un
  // banner antes; lo dejamos simple por ahora.
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { monthlyPriceBob: "asc" },
    select: { slug: true, name: true, monthlyPriceBob: true },
  });

  const verticals = Object.entries(VERTICAL_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-8">
      <Link
        href="/admin/tiendas"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
      >
        <ChevronLeft className="size-4" /> Tiendas
      </Link>

      <h1 className="font-display mt-3 text-3xl">Nueva tienda</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Crea una tienda para mostrar a un cliente potencial. Deja los
        campos de owner vacíos y, cuando acepte, asigna el owner desde el
        detalle.
      </p>

      <div className="mt-8">
        <AdminCreateStoreForm
          verticals={verticals}
          plans={plans.map((p) => ({
            slug: p.slug,
            name: p.name,
            monthlyPriceBob: formatBob(p.monthlyPriceBob),
          }))}
        />
      </div>
    </main>
  );
}
