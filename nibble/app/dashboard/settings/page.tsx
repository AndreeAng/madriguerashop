import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { IdentityForm } from "@/components/dashboard/settings/IdentityForm";
import { PaymentsForm } from "@/components/dashboard/settings/PaymentsForm";
import { DeliveryForm } from "@/components/dashboard/settings/DeliveryForm";
import { HoursForm } from "@/components/dashboard/settings/HoursForm";
import { SeoForm } from "@/components/dashboard/settings/SeoForm";

export const metadata = {
  title: "Configuración · Madriguera Shop",
};

const SECTIONS = [
  { id: "identidad", label: "Identidad y marca" },
  { id: "pagos", label: "Pagos" },
  { id: "delivery", label: "Delivery y recojo" },
  { id: "horarios", label: "Horarios" },
  { id: "seo", label: "SEO y compartir" },
];

export default async function SettingsPage() {
  const { store } = await requireOwnerOnly();
  const hours = await db.storeHours.findMany({
    where: { storeId: store.id },
    orderBy: { dayOfWeek: "asc" },
  });

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Tu tienda
              </p>
              <h1 className="font-display mt-1 text-3xl">Configuración</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Estado:{" "}
                <span className="font-medium text-[color:var(--fg)]">
                  {store.status === "ACTIVE"
                    ? "Activa"
                    : store.status === "PAST_DUE"
                    ? "Pago pendiente"
                    : store.status === "SUSPENDED"
                    ? "Suspendida"
                    : store.status === "CANCELLED"
                    ? "Cancelada"
                    : "Activa"}
                </span>{" "}
                · URL{" "}
                <Link
                  href={`/${store.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-mono text-xs underline decoration-[color:var(--color-amber-300)] decoration-2 underline-offset-4"
                >
                  madrigueras.shop/{store.slug} <ExternalLink className="size-3" />
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr]">
            {/* Anchor nav */}
            <aside className="hidden lg:block">
              <nav className="sticky top-24 space-y-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:bg-[color:var(--card)] hover:text-[color:var(--fg)]"
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="space-y-6">
              <IdentityForm store={store} />
              <PaymentsForm store={store} />
              <DeliveryForm store={store} />
              <HoursForm hours={hours} />
              <SeoForm store={store} />
            </div>
        </div>
      </main>
    </>
  );
}
