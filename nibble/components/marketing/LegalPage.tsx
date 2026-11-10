import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { LegalToc } from "@/components/marketing/LegalToc";
import { marketingFontClass } from "@/lib/fonts/marketing";

const ARTICLE_ID = "legal-article";

/**
 * Plantilla de los documentos legales (términos, privacidad): titular,
 * aviso de borrador si faltan los datos de la entidad, índice lateral y
 * tipografía de lectura. El texto de cada documento llega como `children`.
 */
export function LegalPage({
  title,
  updated,
  complete,
  children,
}: {
  title: string;
  updated: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${marketingFontClass} bg-white`}>
      <MarketingHeader />

      <main id="main-content">
        <header className="border-b border-[color:var(--line)] bg-mk-paper-2">
          <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 md:pb-20 md:pt-24">
            <h1 className="mk-display max-w-4xl break-words text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.92]">
              {title}
            </h1>
            <p className="mt-6 text-mk-soft">Última actualización: {updated}</p>

            {!complete && (
              <div
                role="alert"
                className="mt-8 max-w-3xl rounded-2xl bg-mk-ink p-5 text-mk-on-ink-soft"
              >
                <strong className="font-semibold text-mk-saffron">Borrador no vigente.</strong>{" "}
                Este documento aún no tiene los datos legales de la entidad operadora. No tiene
                validez jurídica hasta que se completen las variables{" "}
                <code className="break-words rounded bg-white/10 px-1.5 py-0.5 text-mk-on-ink">
                  LEGAL_ENTITY_NAME
                </code>{" "}
                y{" "}
                <code className="break-words rounded bg-white/10 px-1.5 py-0.5 text-mk-on-ink">
                  LEGAL_ENTITY_ADDRESS
                </code>
                .
              </div>
            )}
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-12 px-5 py-14 md:py-20 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <LegalToc articleId={ARTICLE_ID} />
            </div>
          </aside>

          <article
            id={ARTICLE_ID}
            className="max-w-[68ch] break-words text-[1.0625rem] leading-relaxed text-mk-soft [&_a]:font-medium [&_a]:text-mk-ink [&_a]:underline [&_a]:decoration-mk-magenta [&_a]:decoration-2 [&_a]:underline-offset-4 [&_a:hover]:text-mk-magenta [&_h2]:mb-3 [&_h2]:mt-14 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-[-0.02em] [&_h2]:text-mk-ink [&_h2]:[font-family:var(--font-display)] [&_h2]:[font-variation-settings:'wdth'_100,'opsz'_48] md:[&_h2]:text-3xl [&>h2:first-child]:mt-0 [&>p:first-child]:mt-0 [&_hr]:my-12 [&_hr]:border-[color:var(--line-strong)] [&_li]:pl-1 [&_li]:marker:text-mk-magenta [&_p]:my-4 [&_strong]:font-semibold [&_strong]:text-mk-ink [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
          >
            {children}
          </article>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
