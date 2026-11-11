import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";
import { marketingFontClass } from "@/lib/fonts/marketing";

// Defensivo: aunque rutas inexistentes a nivel app router devuelven 404
// real (no caen en el soft-404 quirk del [slug]/page.tsx), un crawler que
// llegue por accidente igual debe ver noindex. Coste cero, blindaje
// extra contra SEO indexando 404s.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  // Render por request: la versión estática del build no lleva el nonce de
  // la CSP y el navegador bloquea sus scripts (error en consola en cada 404).
  await connection();
  return (
    <div className={`${marketingFontClass} relative flex min-h-dvh flex-col overflow-hidden bg-mk-ink text-mk-on-ink`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_85%_10%,rgba(212,20,90,0.3),transparent_60%)]"
      />
      <header className="relative mx-auto w-full max-w-7xl px-5 pt-5">
        <Link
          href="/"
          aria-label="Madriguera Shop, inicio"
          className="inline-flex min-h-11 items-center [--fg:var(--color-mk-on-ink)]"
        >
          <NibbleLogo />
        </Link>
      </header>

      <main
        id="main-content"
        className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-16"
      >
        <p
          aria-hidden="true"
          className="mk-display text-[clamp(6rem,22vw,16rem)] font-extrabold leading-[0.8] text-mk-saffron"
        >
          404
        </p>
        <h1 className="mk-display mt-6 max-w-3xl text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.92]">
          Esta página no existe.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-mk-on-ink-soft">
          O fue movida, o el link tiene un typo, o nunca existió. Pasa.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="press inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-mk-magenta px-8 text-base font-semibold text-white transition-colors hover:bg-mk-magenta-deep"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver al inicio
          </Link>
          <Link
            href="/tiendas"
            className="press inline-flex min-h-14 items-center justify-center rounded-full border border-white/25 px-8 text-base font-semibold transition-colors hover:border-white/60 hover:bg-white/5"
          >
            Ver tiendas
          </Link>
        </div>
      </main>
    </div>
  );
}
