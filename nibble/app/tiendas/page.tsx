import Link from "next/link";
import { Search, Star } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { stores } from "@/lib/mock/stores";

const verticals = ["Todos", "Restaurante", "Food Truck", "Retail", "Ferretería", "Servicios"];
const cities = ["Todas las ciudades", "Cochabamba", "Santa Cruz", "La Paz"];

export default function DirectorioPage() {
  return (
    <>
      <MarketingHeader />

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-10">
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
            Directorio
          </p>
          <h1 className="font-display mt-3 text-5xl md:text-6xl">
            Las tiendas que ya viven en Nibble.
          </h1>
          <p className="mt-4 max-w-2xl text-[color:var(--muted)]">
            Hechas por bolivianos, vendiendo a bolivianos. Mirá lo que están haciendo y comprá directo.
          </p>
        </section>

        <section className="border-y border-[color:var(--line)] bg-[color:var(--card)] py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                placeholder="Buscar tienda..."
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] py-2 pl-9 pr-3 text-sm outline-none"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {verticals.map((v, i) => (
                <button
                  key={v}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                    i === 0
                      ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                      : "border-[color:var(--line)] bg-[color:var(--bg)]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <select className="ml-auto rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-1.5 text-xs">
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="group overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] transition hover:-translate-y-0.5 hover:border-[color:var(--color-bark-300)] hover:shadow-lg hover:shadow-black/5"
              >
                <div
                  className="relative h-44 overflow-hidden"
                  style={{ background: s.primaryColor }}
                >
                  <img
                    src={s.bannerImage}
                    alt=""
                    className="h-full w-full object-cover opacity-80 transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] text-black">
                    <Star className="size-3 fill-current text-[color:var(--color-amber-500)]" />
                    {s.rating}
                  </div>
                  <div
                    className="absolute -bottom-6 left-5 flex size-12 items-center justify-center rounded-2xl border-4 border-[color:var(--card)] text-sm font-bold text-white"
                    style={{ background: s.primaryColor }}
                  >
                    {s.logoEmoji}
                  </div>
                </div>
                <div className="p-5 pt-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <span className="text-xs text-[color:var(--muted)]">{s.city}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[color:var(--muted)]">
                    {s.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="rounded-full bg-[color:var(--bg)] px-2 py-1 text-[color:var(--muted)]">
                      {s.vertical}
                    </span>
                    <span className="text-[color:var(--muted)]">
                      {s.ordersThisMonth} pedidos/mes
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
