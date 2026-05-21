import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Compass } from "lucide-react";

// Defensivo: aunque rutas inexistentes a nivel app router devuelven 404
// real (no caen en el soft-404 quirk del [slug]/page.tsx), un crawler que
// llegue por accidente igual debe ver noindex. Coste cero, blindaje
// extra contra SEO indexando 404s.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[color:var(--bg)] p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]">
          <Compass className="size-6" />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Error 404
        </p>
        <h1 className="font-display mt-3 text-5xl leading-tight">
          Esta página no existe
        </h1>
        <p className="mt-4 text-[color:var(--muted)]">
          O fue movida, o el link tiene un typo, o nunca existió. Pasa.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>
          <Link
            href="/tiendas"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] hover:underline"
          >
            Ver tiendas
          </Link>
        </div>
      </div>
    </main>
  );
}
