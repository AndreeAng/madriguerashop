import Link from "next/link";
import { Plus, Layout as LayoutIcon, Eye, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { verticalLabel } from "@/lib/saas/verticals";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Plantillas · Admin" };

export default async function AdminPlantillasPage() {
  await requireSuperAdmin();

  const templates = await db.template.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { stores: true } },
    },
  });

  return (
    <main className="p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Plataforma
              </p>
              <h1 className="font-display mt-1 text-3xl">Plantillas de tienda</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {templates.length} plantilla{templates.length === 1 ? "" : "s"} ·{" "}
                {templates.filter((t) => t.isActive).length} activa
                {templates.filter((t) => t.isActive).length === 1 ? "" : "s"}
              </p>
            </div>
            <Link
              href="/admin/plantillas/nueva"
              className="press inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              <Plus className="size-4" /> Nueva plantilla
            </Link>
          </div>

          {templates.length === 0 ? (
            <EmptyState
              className="mt-8 border-solid"
              icon={<LayoutIcon className="size-8" />}
              description="Todavía no hay plantillas. Creá la primera."
            />
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <article
                  key={t.id}
                  className="overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] transition hover:-translate-y-0.5 hover:border-[color:var(--color-bark-300)] hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="relative aspect-video bg-[color:var(--bg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.previewUrl}
                      alt={`Preview de ${t.name}`}
                      className="size-full object-cover"
                    />
                    {!t.isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--color-bark-900)]/60">
                        <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[color:var(--color-bark-900)]">
                          Inactiva
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{t.name}</h3>
                        <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-amber-600)]">
                          {verticalLabel(t.vertical)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[color:var(--bg)] px-2 py-1 text-[11px] font-medium text-[color:var(--muted)]">
                        {t._count.stores} tienda{t._count.stores === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-[color:var(--muted)]">
                      {t.description}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-[color:var(--muted)]">
                      {t.componentKey}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/admin/plantillas/${t.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--line-strong)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--bg)]"
                      >
                        <Pencil className="size-3.5" /> Editar
                      </Link>
                      <a
                        href={t.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--line-strong)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--bg)]"
                      >
                        <Eye className="size-3.5" /> Preview
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
    </main>
  );
}
