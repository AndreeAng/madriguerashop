import Link from "next/link";
import { Star } from "lucide-react";
import { StoreStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { verticalLabel } from "@/lib/saas/verticals";

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

  return (
    <>
      <MarketingHeader />

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-10">
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
            Directorio
          </p>
          <h1 className="font-display mt-3 text-5xl md:text-6xl">
            Las tiendas que ya viven en Madriguera Shop.
          </h1>
          <p className="mt-4 max-w-2xl text-[color:var(--muted)]">
            Hechas por bolivianos, vendiendo a bolivianos. Mira lo que están haciendo y compra directo.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          {storesRaw.length === 0 ? (
            <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-12 text-center">
              <p className="text-[color:var(--muted)]">
                Todavía no hay tiendas listadas. Sé la primera —{" "}
                <Link
                  href="/registro"
                  className="font-medium text-[color:var(--fg)] underline"
                >
                  crea tu tienda en 5 minutos
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {storesRaw.map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  className="group overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] transition hover:-translate-y-0.5 hover:border-[color:var(--color-bark-300)] hover:shadow-lg hover:shadow-black/5"
                >
                  <div
                    className="relative h-44 overflow-hidden"
                    style={{ background: s.primaryColor }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.bannerUrl ?? FALLBACK_BANNER}
                      alt=""
                      className="h-full w-full object-cover opacity-80 transition group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-black">
                      <Star className="size-3 fill-current text-[color:var(--color-amber-500)]" />
                      Verificada
                    </div>
                    <div
                      className="absolute -bottom-6 left-5 grid size-12 place-items-center overflow-hidden rounded-2xl border-4 border-[color:var(--card)] text-sm font-bold text-white"
                      style={{ background: s.primaryColor }}
                    >
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.logoUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        initials(s.name)
                      )}
                    </div>
                  </div>
                  <div className="p-5 pt-8">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold leading-tight">
                        {s.name}
                      </h3>
                      <span className="text-xs text-[color:var(--muted)] shrink-0">
                        {s.city ?? "Bolivia"}
                      </span>
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-[color:var(--muted)]">
                        {s.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="rounded-full bg-[color:var(--bg)] px-2 py-1 text-[color:var(--muted)]">
                        {verticalLabel(s.vertical)}
                      </span>
                      <span className="text-[color:var(--muted)]">
                        Ver tienda →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
