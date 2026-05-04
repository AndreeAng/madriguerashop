import { Quote, Star } from "lucide-react";

type Review = {
  name: string;
  initials: string;
  rating: number;
  ordered: string;
  quote: string;
  date: string;
  accent: "amber" | "leaf" | "tomato";
};

const reviews: Review[] = [
  {
    name: "Camila Rojas",
    initials: "CR",
    rating: 5,
    ordered: "Wings Clásicos BBQ",
    quote:
      "Llegó en 25 minutos y aún calientes. La salsa BBQ es increíble, ya pedí tres veces este mes.",
    date: "hace 2 días",
    accent: "amber",
  },
  {
    name: "Diego Montaño",
    initials: "DM",
    rating: 5,
    ordered: "Combo Familiar",
    quote:
      "Pedí para la familia un sábado y todos contentos. Excelente relación calidad-precio, recomendado.",
    date: "hace 5 días",
    accent: "tomato",
  },
  {
    name: "Lucía Vargas",
    initials: "LV",
    rating: 4,
    ordered: "Buffalo Hot",
    quote:
      "El picante justo, no exagerado. Atención por WhatsApp súper rápida, me confirmaron en 3 minutos.",
    date: "hace 1 semana",
    accent: "leaf",
  },
];

const accentMap: Record<Review["accent"], string> = {
  amber: "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)] ring-[color:var(--color-amber-200)]",
  leaf: "bg-[color:var(--color-leaf-500)]/10 text-[color:var(--color-leaf-600)] ring-[color:var(--color-leaf-500)]/30",
  tomato:
    "bg-[color:var(--color-tomato-500)]/10 text-[color:var(--color-tomato-600)] ring-[color:var(--color-tomato-500)]/30",
};

export function Testimonials({ rating, ordersThisMonth }: { rating: number; ordersThisMonth: number }) {
  return (
    <section
      aria-label="Reseñas de clientes"
      className="mx-auto mt-16 max-w-6xl px-4"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-amber-100)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-amber-700)]">
            <Star className="size-3 fill-current" /> Reseñas verificadas
          </span>
          <h2 className="font-display mt-3 text-3xl leading-tight md:text-4xl">
            Lo que dicen <span className="underline-amber-dark">nuestros clientes</span>
          </h2>
        </div>
        <div className="hidden text-right md:block">
          <div className="flex items-center gap-2">
            <span className="font-display num-tabular text-3xl leading-none">
              {rating}
            </span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-4 ${
                    i < Math.round(rating)
                      ? "fill-[color:var(--color-amber-500)] text-[color:var(--color-amber-500)]"
                      : "text-[color:var(--color-bark-200)]"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Basado en <span className="num-tabular">{ordersThisMonth}+</span> pedidos este mes
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {reviews.map((r, i) => (
          <figure
            key={r.name}
            className="relative flex flex-col rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-card animate-slide-up"
            style={{ animationDelay: `${0.05 + i * 0.07}s` }}
          >
            <Quote
              aria-hidden
              className="absolute right-5 top-5 size-8 text-[color:var(--color-amber-200)]"
              strokeWidth={1.5}
            />

            <div className="flex">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star
                  key={idx}
                  className={`size-3.5 ${
                    idx < r.rating
                      ? "fill-[color:var(--color-amber-500)] text-[color:var(--color-amber-500)]"
                      : "text-[color:var(--color-bark-200)]"
                  }`}
                />
              ))}
            </div>

            <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-[color:var(--fg-soft)]">
              “{r.quote}”
            </blockquote>

            <figcaption className="mt-5 flex items-center gap-3 border-t border-[color:var(--line)] pt-4">
              <div
                className={`grid size-10 shrink-0 place-items-center rounded-full ring-1 text-sm font-bold ${accentMap[r.accent]}`}
              >
                {r.initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{r.name}</p>
                <p className="truncate text-[11px] text-[color:var(--muted)]">
                  Pidió <span className="font-medium text-[color:var(--fg-soft)]">{r.ordered}</span>
                  <span className="mx-1.5">·</span>
                  {r.date}
                </p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
