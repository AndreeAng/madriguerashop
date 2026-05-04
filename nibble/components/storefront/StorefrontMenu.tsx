"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Flame } from "lucide-react";
import type { MockProduct } from "@/lib/mock/products";
import type { MockStore } from "@/lib/mock/stores";
import { ProductCard } from "./ProductCard";
import { ProductQuickView } from "./ProductQuickView";

const ALL_KEY = "todos";
const slugCat = (c: string) => c.toLowerCase().replace(/\s+/g, "-");

export function StorefrontMenu({
  store,
  featured,
  populatedCategories,
  productsByCategory,
  promoSlot,
}: {
  store: MockStore;
  featured: MockProduct[];
  populatedCategories: string[];
  productsByCategory: Record<string, MockProduct[]>;
  promoSlot?: ReactNode;
}) {
  const [active, setActive] = useState<MockProduct | null>(null);
  const [activeCat, setActiveCat] = useState<string>(ALL_KEY);
  const navScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sectionIds = [`destacados`, ...populatedCategories.map((c) => `cat-${slugCat(c)}`)];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          const id = visible[0].target.id;
          if (id === "destacados") setActiveCat(ALL_KEY);
          else setActiveCat(id.replace("cat-", ""));
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [populatedCategories]);

  // Auto-scroll the chip into view in the horizontal nav
  useEffect(() => {
    if (!navScrollRef.current) return;
    const el = navScrollRef.current.querySelector<HTMLElement>(
      `[data-cat="${activeCat}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeCat]);

  const handleChipClick = (key: string) => {
    const targetId = key === ALL_KEY ? "destacados" : `cat-${key}`;
    const el = document.getElementById(targetId);
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Sticky category nav with active state */}
      <nav
        id="menu"
        aria-label="Categorías del menú"
        className="sticky top-16 z-30 mt-10 border-y border-[color:var(--line)] glass"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div ref={navScrollRef} className="scrollbar-hide flex gap-2 overflow-x-auto py-3">
            <CategoryChip
              name="Todos"
              active={activeCat === ALL_KEY}
              onClick={() => handleChipClick(ALL_KEY)}
              dataKey={ALL_KEY}
            />
            {populatedCategories.map((c) => {
              const key = slugCat(c);
              const count = productsByCategory[c]?.length ?? 0;
              return (
                <CategoryChip
                  key={c}
                  name={c}
                  count={count}
                  active={activeCat === key}
                  onClick={() => handleChipClick(key)}
                  dataKey={key}
                />
              );
            })}
          </div>
        </div>
      </nav>

      {/* Featured — editorial 1 hero + 2 stacked layout */}
      <section id="destacados" className="mx-auto max-w-6xl scroll-mt-32 px-4 pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-amber-100)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-amber-700)]">
              <Flame className="size-3" /> Lo más pedido hoy
            </span>
            <h2 className="font-display mt-3 text-3xl leading-tight md:text-4xl">
              Las <span className="underline-amber">imperdibles</span> de la casa
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-[color:var(--muted)]">
              Tres platos que nuestros clientes piden semana tras semana.
            </p>
          </div>
          <a
            href="#cat-wings"
            onClick={(e) => {
              e.preventDefault();
              handleChipClick(slugCat(populatedCategories[0] || ""));
            }}
            className="hidden items-center gap-1 text-sm font-medium text-[color:var(--fg-soft)] hover:text-[color:var(--color-amber-600)] md:inline-flex"
          >
            Ver todo <ChevronRight className="size-4" />
          </a>
        </div>

        {featured.length >= 3 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 md:grid-rows-2">
            <div
              className="animate-slide-up md:row-span-2"
              style={{ animationDelay: "0.05s" }}
            >
              <ProductCard product={featured[0]} onOpen={setActive} variant="hero" />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
              <ProductCard product={featured[1]} onOpen={setActive} variant="row" />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "0.18s" }}>
              <ProductCard product={featured[2]} onOpen={setActive} variant="row" />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {featured.map((p, i) => (
              <div
                key={p.slug}
                className="animate-slide-up"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <ProductCard product={p} onOpen={setActive} />
              </div>
            ))}
          </div>
        )}
      </section>

      {promoSlot}

      {/* Catalog by category */}
      <div id="catalogo">
        {populatedCategories.map((cat, idx) => {
          const list = productsByCategory[cat];
          if (!list?.length) return null;
          return (
            <section
              key={cat}
              id={`cat-${slugCat(cat)}`}
              className="mx-auto mt-14 max-w-6xl scroll-mt-32 px-4"
            >
              <div className="flex items-end justify-between border-b border-[color:var(--line)] pb-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-display num-tabular text-sm text-[color:var(--color-amber-600)]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl leading-tight md:text-3xl">{cat}</h2>
                </div>
                <p className="num-tabular text-xs uppercase tracking-wider text-[color:var(--muted)]">
                  {list.length} {list.length === 1 ? "producto" : "productos"}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {list.map((p) => (
                  <ProductCard key={p.slug} product={p} onOpen={setActive} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {active && (
        <ProductQuickView
          product={active}
          city={store.city}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

function CategoryChip({
  name,
  count,
  active,
  onClick,
  dataKey,
}: {
  name: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  dataKey: string;
}) {
  return (
    <button
      type="button"
      data-cat={dataKey}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white shadow-pill"
          : "border-[color:var(--line)] bg-[color:var(--card)] text-[color:var(--fg-soft)] hover:border-[color:var(--color-amber-300)] hover:bg-[color:var(--color-amber-50)] hover:text-[color:var(--color-bark-900)]"
      }`}
    >
      {name}
      {count !== undefined && (
        <span
          className={`num-tabular rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            active
              ? "bg-white/15 text-white/90"
              : "bg-[color:var(--bg)] text-[color:var(--muted)]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
