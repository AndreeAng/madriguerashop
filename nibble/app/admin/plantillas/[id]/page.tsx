import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { TemplateForm } from "@/components/admin/plantillas/TemplateForm";
import { TemplateDangerZone } from "@/components/admin/plantillas/TemplateDangerZone";

export const metadata = { title: "Editar plantilla · Admin" };

export default async function EditarPlantillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const template = await db.template.findUnique({
    where: { id },
    include: {
      _count: { select: { stores: true } },
      stores: {
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
        take: 50,
      },
    },
  });
  if (!template) notFound();

  const otherTemplates = await db.template.findMany({
    where: { id: { not: template.id } },
    select: { id: true, name: true, isActive: true, _count: { select: { stores: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-12">
          <Link
            href="/admin/plantillas"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            <ArrowLeft className="size-4" /> Volver a plantillas
          </Link>
          <h1 className="font-display mt-4 text-3xl">{template.name}</h1>

          <div className="mt-8 space-y-8">
            <TemplateForm
              template={{
                id: template.id,
                name: template.name,
                vertical: template.vertical,
                description: template.description,
                previewUrl: template.previewUrl,
                componentKey: template.componentKey,
                sortOrder: template.sortOrder,
                isActive: template.isActive,
              }}
            />

            {template._count.stores > 0 && (
              <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
                <h2 className="font-display text-lg">
                  Tiendas usando esta plantilla ({template._count.stores})
                </h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {template.stores.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-2"
                    >
                      <span className="truncate text-sm">{s.name}</span>
                      <Link
                        href={`/${s.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[color:var(--color-amber-600)] hover:underline"
                      >
                        Ver →
                      </Link>
                    </li>
                  ))}
                </ul>
                {template._count.stores > 50 && (
                  <p className="mt-3 text-xs text-[color:var(--muted)]">
                    Mostrando 50 de {template._count.stores}.
                  </p>
                )}
              </section>
            )}

            <TemplateDangerZone
              templateId={template.id}
              templateName={template.name}
              storesUsing={template._count.stores}
              otherTemplates={otherTemplates.filter((t) => t.isActive)}
            />
      </div>
    </main>
  );
}
