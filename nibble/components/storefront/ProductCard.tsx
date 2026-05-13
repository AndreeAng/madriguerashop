"use client";

import { CalendarClock, Plus, Star, Flame } from "lucide-react";
import Image from "next/image";
import type { ProductView } from "@/lib/storefront/types";
import { formatBob } from "@/lib/utils";

const badgeStyles: Record<string, string> = {
  best: "bg-[color:var(--color-amber-500)] text-white shadow-pill",
  new: "bg-[color:var(--color-leaf-500)] text-white shadow-pill",
  promo: "bg-[color:var(--color-tomato-500)] text-white shadow-pill",
};

const badgeIcon: Record<string, React.ReactNode> = {
  best: <Star className="size-3 fill-current" />,
  promo: <Flame className="size-3 fill-current" />,
};

type Variant = "default" | "hero" | "row";

export function ProductCard({
  product,
  onOpen,
  variant = "default",
}: {
  product: ProductView;
  onOpen?: (product: ProductView) => void;
  variant?: Variant;
}) {
  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : null;

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(product)}
        disabled={!product.available}
        aria-label={`Ver ${product.name}`}
        className="group flex w-full items-stretch gap-3 overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--card)] text-left ring-1 ring-[color:var(--line)] transition-all duration-300 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 hover:ring-[color:var(--line-strong)] disabled:cursor-not-allowed sm:gap-4"
      >
        <div className="relative aspect-square w-32 shrink-0 overflow-hidden bg-[color:var(--card-soft)] sm:w-40 md:w-44">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 35vw, 200px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
          />
          {product.badge && product.badgeLabel && (
            <span
              className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeStyles[product.badge]}`}
            >
              {badgeIcon[product.badge]}
              {product.badgeLabel}
            </span>
          )}
          {!product.available && (
            <div className="absolute inset-0 grid place-items-center bg-[color:var(--bg)]/85">
              <span className="rounded-full bg-[color:var(--ink)] px-2 py-1 text-[10px] font-semibold text-[color:var(--bg)]">
                Agotado
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-3 pr-3 sm:py-4 sm:pr-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
            {product.category}
          </p>
          <h3 className="font-display mt-1 line-clamp-1 text-base leading-tight">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[color:var(--muted)]">
            {product.description}
          </p>

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display num-tabular text-lg leading-none text-[color:var(--ink)]">
                {formatBob(product.price)}
              </span>
              {product.comparePrice && (
                <span className="num-tabular text-[11px] text-[color:var(--muted)] line-through">
                  {formatBob(product.comparePrice)}
                </span>
              )}
            </div>

            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full bg-[color:var(--color-bark-900)] text-white transition-all duration-200 group-hover:scale-110 group-hover:bg-[color:var(--color-amber-500)] group-active:scale-95"
            >
              {product.isBookable ? (
                <CalendarClock className="size-4 transition-transform duration-200 group-hover:scale-110" />
              ) : (
                <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
              )}
            </span>
          </div>
        </div>
      </button>
    );
  }

  const isHero = variant === "hero";

  return (
    <button
      type="button"
      onClick={() => onOpen?.(product)}
      disabled={!product.available}
      aria-label={`Ver ${product.name}`}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--card)] text-left ring-1 ring-[color:var(--line)] transition-all duration-300 hover:-translate-y-1 hover:ring-[color:var(--line-strong)] shadow-card hover:shadow-card-hover disabled:cursor-not-allowed`}
    >
      <div
        className={`relative overflow-hidden bg-[color:var(--card-soft)] ${
          isHero ? "aspect-[4/5] md:aspect-auto md:flex-1" : "aspect-[5/4]"
        }`}
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          priority={isHero}
          sizes={isHero ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          {product.badge && product.badgeLabel ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${badgeStyles[product.badge]}`}
            >
              {badgeIcon[product.badge]}
              {product.badgeLabel}
            </span>
          ) : (
            <span />
          )}
          {discount && (
            <span className="rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-[color:var(--color-tomato-600)] shadow-pill backdrop-blur">
              -{discount}%
            </span>
          )}
        </div>

        {product.rating && (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Star className="size-3 fill-[color:var(--color-amber-300)] text-[color:var(--color-amber-300)]" />
            <span className="num-tabular">{product.rating}</span>
          </div>
        )}

        {/* "#1 más vendido" solo cuando el producto está realmente marcado
            como best seller; antes se mostraba en cualquier hero, mintiendo. */}
        {isHero && product.badge === "best" && (
          <div className="absolute bottom-3 right-3 hidden rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-bark-900)] shadow-pill backdrop-blur md:inline-flex">
            <Star className="mr-1 size-3 fill-[color:var(--color-amber-500)] text-[color:var(--color-amber-500)]" />
            #1 más vendido
          </div>
        )}

        {!product.available && (
          <div className="absolute inset-0 grid place-items-center bg-[color:var(--bg)]/85 backdrop-blur-[2px]">
            <span className="rounded-full bg-[color:var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-[color:var(--bg)]">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col ${isHero ? "p-5 md:p-6" : "p-4"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
          {product.category}
        </p>
        <h3
          className={`font-display mt-1 leading-tight ${
            isHero ? "text-xl md:text-2xl" : "line-clamp-1 text-base"
          }`}
        >
          {product.name}
        </h3>
        <p
          className={`mt-1.5 leading-relaxed text-[color:var(--muted)] ${
            isHero ? "line-clamp-3 text-sm md:text-[15px]" : "line-clamp-2 text-[13px]"
          }`}
        >
          {product.description}
        </p>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {product.comparePrice && (
              <span className="text-[11px] text-[color:var(--muted)] line-through num-tabular">
                {formatBob(product.comparePrice)}
              </span>
            )}
            <span
              className={`font-display num-tabular leading-none tracking-tight text-[color:var(--ink)] ${
                isHero ? "text-2xl md:text-3xl" : "text-xl"
              }`}
            >
              {formatBob(product.price)}
            </span>
          </div>

          <span
            aria-hidden
            className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-[color:var(--color-bark-900)] font-semibold text-white transition-all duration-200 group-hover:scale-105 group-active:scale-95 group-hover:bg-[color:var(--color-amber-500)] group-disabled:opacity-30 group-disabled:group-hover:bg-[color:var(--color-bark-900)] ${
              isHero ? "h-11 px-4 text-sm" : "h-10 px-3.5 text-sm"
            }`}
          >
            <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
            <span className="hidden sm:inline">Agregar</span>
          </span>
        </div>
      </div>
    </button>
  );
}
