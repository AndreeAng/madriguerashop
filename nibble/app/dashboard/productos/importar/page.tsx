import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireOwnerOnly } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ImportProductsForm } from "@/components/dashboard/productos/ImportProductsForm";

export const metadata = {
  title: "Importar productos · Madriguera Shop",
};

export default async function ImportProductsPage() {
  const { store } = await requireOwnerOnly();

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="mx-auto max-w-3xl p-6 lg:p-8">
        <Link
          href="/dashboard/productos"
          className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          <ChevronLeft className="size-4" /> Volver al catálogo
        </Link>

        <h1 className="font-display mt-3 text-3xl">Importar productos</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Sube un CSV para crear muchos productos de una. Útil para migrar
          desde otra plataforma o cargar un catálogo nuevo.
        </p>

        <section className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
          <h2 className="text-sm font-semibold">Formato del CSV</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            La primera fila debe ser el header. Coma como separador. UTF-8.
          </p>
          <table className="mt-3 w-full text-xs">
            <thead className="text-[color:var(--muted)]">
              <tr className="border-b border-[color:var(--line)]">
                <th scope="col" className="py-2 text-left font-medium">Columna</th>
                <th scope="col" className="py-2 text-left font-medium">Requerido</th>
                <th scope="col" className="py-2 text-left font-medium">Ejemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              <Row col="nombre" required ex="Pizza Margherita" />
              <Row col="precio" required ex="89.50" />
              <Row col="slug" ex="pizza-margherita" />
              <Row col="sku" ex="PZ-001" />
              <Row col="categoría" ex="Pizzas (debe existir en tu tienda)" />
              <Row col="stock" ex="20 (entero)" />
              <Row col="descripción" ex="Texto corto, hasta 280 chars" />
            </tbody>
          </table>
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer text-[color:var(--muted)] hover:text-[color:var(--fg)]">
              Ver ejemplo de CSV
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[color:var(--bg)] p-3 text-[11px] leading-relaxed">{`nombre,precio,slug,sku,categoría,stock,descripción
Pizza Margherita,89.50,pizza-margherita,PZ-001,Pizzas,20,Mozzarella + albahaca
Pizza Pepperoni,99.00,,PZ-002,Pizzas,15,
Empanada de carne,12.00,,EM-001,Empanadas,,Frita al momento`}</pre>
          </details>
        </section>

        <section className="mt-6">
          <ImportProductsForm />
        </section>

        <div className="mt-6 rounded-xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-3 text-xs text-[color:var(--color-amber-700)]">
          <p>
            <strong>Importante:</strong> los productos con slug duplicado se
            omiten (no se actualizan). Para editar productos existentes,
            usa la UI del catálogo. Las imágenes se cargan después manualmente
            desde cada producto.
          </p>
        </div>
      </main>
    </>
  );
}

function Row({ col, required, ex }: { col: string; required?: boolean; ex: string }) {
  return (
    <tr>
      <td className="py-2 font-mono">{col}</td>
      <td className="py-2">
        {required ? (
          <span className="text-[color:var(--color-tomato-600)]">sí</span>
        ) : (
          <span className="text-[color:var(--muted)]">no</span>
        )}
      </td>
      <td className="py-2 text-[color:var(--muted)]">{ex}</td>
    </tr>
  );
}
