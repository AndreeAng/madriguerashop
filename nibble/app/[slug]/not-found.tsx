import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Compass, MessageCircle } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";

const SUPPORT_WA = "59172201700";

/**
 * Mitigación SEO contra el soft-404 de Next.js 15 RSC.
 *
 * `notFound()` desde un Server Component server-renderizado no propaga
 * status 404 — Next ya empezó a streamear el árbol RSC (con status 200
 * en el primer chunk) cuando la page resuelve a la not-found UI. Verificado
 * empíricamente contra el deploy de Vercel: `curl -I /<slug-inexistente>`
 * devuelve `HTTP/1.1 200 OK` con el body del [slug]/not-found.tsx.
 *
 * Sin mitigación: Google indexa URLs como `/tienda-falsa-randoma` como
 * páginas válidas (status 200), contaminando el ranking del dominio con
 * páginas que dicen "Esta tienda no está disponible".
 *
 * Con `robots: { index: false, follow: false }` Next emite el meta tag
 * `<meta name="robots" content="noindex, nofollow">` que Googlebot
 * respeta — la página no se indexa aunque el status HTTP siga siendo 200.
 *
 * Resuelve el problema real (SEO) sin tocar arquitectura. Cuando Next
 * publique una fix para `notFound()` + RSC streaming, este meta queda
 * como redundante pero inocuo.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StoreNotFound() {
  return (
    <>
      <MarketingHeader />
      <main className="grid min-h-[60vh] place-items-center px-5 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]">
            <Compass className="size-6" />
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Tienda no encontrada
          </p>
          <h1 className="font-display mt-3 text-4xl leading-tight md:text-5xl">
            Esta tienda no está disponible
          </h1>
          <p className="mt-4 text-[color:var(--muted)]">
            Puede que el link sea incorrecto, que la tienda esté temporalmente
            fuera de servicio, o que aún no esté pública.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/tiendas"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              Ver el directorio de tiendas
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={`https://wa.me/${SUPPORT_WA}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            >
              <MessageCircle className="size-4" />
              Contactar soporte
            </Link>
          </div>

          <p className="mt-8 text-xs text-[color:var(--muted)]">
            ¿Tienes una tienda?{" "}
            <Link href="/registro" className="font-medium text-[color:var(--fg)] hover:underline">
              Crea la tuya en 5 minutos
            </Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
