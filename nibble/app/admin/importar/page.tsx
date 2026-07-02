import { requireSuperAdmin } from "@/lib/auth/session";
import { VERTICAL_LABELS } from "@/lib/saas/verticals";
import { ImportQuickForm } from "@/components/admin/importar/ImportQuickForm";

export const metadata = { title: "Importar de Quick · Admin" };

// La server action del import descarga ~90 imágenes desde quick.com.bo +
// las sube a Vercel Blob + bulk-inserta los productos. Optimizaciones
// aplicadas (ver importer.ts):
//   - Pool de 12 workers (no batches que bloqueen al worst-case).
//   - `saveImageRaw` salta sharp (~30s de CPU ahorrados en 90 imágenes).
//   - `createManyAndReturn` en lugar de 92 INSERTs secuenciales.
// Tiempo target: 15-25s para 90+ productos. 60s es el máximo del Hobby
// plan de Vercel — nos da ~2x headroom contra latencias largas.
export const maxDuration = 60;

export default async function AdminImportPage() {
  await requireSuperAdmin();

  const verticals = Object.entries(VERTICAL_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-10">
      <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
        Captación
      </p>
      <h1 className="font-display mt-1 text-3xl">Importar tienda de Quick</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Migra una tienda de <code className="rounded bg-[color:var(--card)] px-1.5 py-0.5 text-xs">cat.quick.com.bo</code>{" "}
        a Madriguera Shop. Trae categorías, productos, descripciones e imágenes.
        Las variantes/tallas no se importan (Quick las modela como texto
        libre); el owner las agrega después si quiere.
      </p>

      <div className="mt-6 rounded-xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-3 text-xs text-[color:var(--color-amber-800)]">
        <strong>Antes de importar:</strong> asegúrate de tener autorización
        del dueño de la tienda original. Las imágenes y descripciones son
        contenido del competidor — solo importas cuando el cliente nos pide
        migrar a Madriguera.
      </div>

      <div className="mt-8">
        <ImportQuickForm verticals={verticals} />
      </div>
    </main>
  );
}
