import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { StoreStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { verticalLabel } from "@/lib/saas/verticals";
import { storeActionColors } from "@/lib/storefront/theme";
import { marketingFontClass } from "@/lib/fonts/marketing";

// Lee de DB → renderizar en cada request, no SSG en build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Directorio de tiendas · Madriguera Shop",
  description:
    "Las tiendas que ya viven en Madriguera Shop. Hechas por bolivianos, vendiendo a bolivianos.",
};

// Placeholder local (mismo asset que el storefront) — sin dependencia de
// Unsplash para tiendas que aún no subieron banner.
const FALLBACK_BANNER = "/placeholders/banner.webp";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

export default async function DirectorioPage() {
  // Sólo tiendas listadas públicamente y operativas
  const storesRaw = await db.store.findMany({
    where: {
      isPubliclyListed: true,
      status: { in: [StoreStatus.ACTIVE, StoreStatus.PAST_DUE] },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      vertical: true,
      city: true,
      description: true,
      primaryColor: true,
      bannerUrl: true,
      logoUrl: true,
    },
  });

  const count = storesRaw.length;

  return (
    <div className={`${marketingFontClass} bg-white`}>
      <MarketingHeader tone="dark" />

      <main id="main-content">
        <section className="relative -mt-16 overflow-hidden bg-mk-ink pt-16 text-mk-on-ink">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_90%_0%,rgba(212,20,90,0.26),transparent_60%)]"
          />
          <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 md:pb-24 md:pt-20">
            <h1 className="mk-display max-w-5xl text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.9]">
              Las tiendas que ya viven en{" "}
              <span className="text-mk-saffron">Madriguera Shop.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-mk-on-ink-soft md:text-xl">
              Hechas por bolivianos, vendiendo a bolivianos. Mira lo que están haciendo y compra
              directo.
            </p>
            {count > 0 && (
              <p className="mt-8 text-sm text-mk-on-ink-soft">
                <span className="font-semibold text-mk-on-ink num-tabular">{count}</span>{" "}
                {count === 1 ? "tienda abierta" : "tiendas abiertas"}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 md:py-24">
          {count === 0 ? (
            <div className="rounded-[2rem] bg-mk-paper-2 p-10 text-center md:p-16">
              <h2 className="mk-display text-4xl font-bold leading-tight md:text-5xl">
                Todavía no hay tiendas listadas.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-mk-soft">
                Sé la primera: tu tienda puede aparecer aquí hoy.
              </p>
              <Link
                href="/registro"
                className="press group mt-8 inline-flex min-h-13 items-center gap-2 rounded-full bg-mk-magenta px-7 font-semibold text-white transition-colors hover:bg-mk-magenta-deep"
              >
                Crea tu tienda en 5 minutos
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {storesRaw.map((s) => {
                const { action, onAction } = storeActionColors(s.primaryColor);
                return (
                  <li key={s.slug} className="mk-reveal">
                    <Link
                      href={`/${s.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-white transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(18,16,22,0.35)]"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: action }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.bannerUrl ?? FALLBACK_BANNER}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                        <span
                          className="absolute bottom-4 left-4 grid size-14 place-items-center overflow-hidden rounded-2xl text-base font-bold ring-4 ring-white"
                          style={{ background: action, color: onAction }}
                        >
                          {s.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.logoUrl} alt="" className="size-full object-cover" />
                          ) : (
                            initials(s.name)
                          )}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h2 className="mk-display-wide text-2xl font-semibold leading-tight">
                          {s.name}
                        </h2>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mk-muted">
                          <span>{verticalLabel(s.vertical)}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin aria-hidden="true" className="size-3.5" />
                            {s.city ?? "Bolivia"}
                          </span>
                        </p>
                        {s.description && (
                          <p className="mt-3 line-clamp-2 leading-relaxed text-mk-soft">
                            {s.description}
                          </p>
                        )}
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-mk-ink">
                          Ver tienda
                          <ArrowUpRight
                            aria-hidden="true"
                            className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-mk-magenta text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 md:flex-row md:items-end md:py-20">
            <h2 className="mk-display max-w-2xl text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.92]">
              ¿Tu negocio todavía no está aquí?
            </h2>
            <Link
              href="/registro"
              className="press group inline-flex min-h-14 shrink-0 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-mk-ink transition-colors hover:bg-mk-saffron"
            >
              Crear mi tienda
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
