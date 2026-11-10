import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MessageCircle } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { marketingFontClass } from "@/lib/fonts/marketing";

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
    <div className={`${marketingFontClass} bg-white`}>
      <MarketingHeader />
      <main id="main-content" className="mx-auto max-w-7xl px-5 py-20 md:py-32">
        <h1 className="mk-display max-w-4xl break-words text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.9]">
          Esta tienda <span className="text-mk-magenta">no está disponible.</span>
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-mk-soft">
          Puede que el link sea incorrecto, que la tienda esté temporalmente fuera de servicio, o
          que aún no esté pública.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/tiendas"
            className="press group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-mk-magenta px-8 text-base font-semibold text-white transition-colors hover:bg-mk-magenta-deep"
          >
            Ver el directorio de tiendas
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href={`https://wa.me/${SUPPORT_WA}`}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-mk-ink px-8 text-base font-semibold transition-colors hover:bg-mk-ink hover:text-white"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Contactar soporte
          </Link>
        </div>

        <p className="mt-12 text-mk-soft">
          ¿Tienes un negocio?{" "}
          <Link
            href="/registro"
            className="font-semibold text-mk-ink underline decoration-mk-magenta decoration-2 underline-offset-4 hover:text-mk-magenta"
          >
            Crea tu tienda en 5 minutos
          </Link>
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
