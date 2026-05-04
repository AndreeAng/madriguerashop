"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { X, Minus, Plus, Star, Clock, MessageCircle, Flame, ShoppingBag } from "lucide-react";
import type { MockProduct } from "@/lib/mock/products";
import { formatBob } from "@/lib/utils";

const badgeStyles: Record<string, string> = {
  best: "bg-[color:var(--color-amber-500)] text-white",
  new: "bg-[color:var(--color-leaf-500)] text-white",
  promo: "bg-[color:var(--color-tomato-500)] text-white",
};

export function ProductQuickView({
  product,
  city,
  onClose,
}: {
  product: MockProduct;
  city: string;
  onClose: () => void;
}) {
  const defaultVariant = product.variants?.findIndex((v) => v.priceDelta === 0) ?? -1;
  const [variantIdx, setVariantIdx] = useState(defaultVariant >= 0 ? defaultVariant : 0);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const variant = product.variants?.[variantIdx];
  const unitPrice = product.price + (variant?.priceDelta ?? 0);
  const total = unitPrice * qty;

  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Scrim */}
      <button
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[color:var(--color-bark-900)]/55 backdrop-blur-sm animate-slide-up"
      />

      {/* Sheet / dialog */}
      <div
        ref={sheetRef}
        className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-[color:var(--card)] shadow-float animate-pop sm:max-h-[88vh] sm:rounded-3xl"
      >
        {/* Mobile drag handle */}
        <div className="flex h-2 items-center justify-center pt-3 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-[color:var(--line-strong)]" />
        </div>

        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-full bg-white/95 text-[color:var(--color-bark-900)] shadow-pill backdrop-blur transition hover:scale-105 active:scale-95"
        >
          <X aria-hidden className="size-4" />
        </button>

        <div className="flex max-h-[92vh] flex-col overflow-y-auto sm:grid sm:max-h-[88vh] sm:grid-cols-[1.05fr_1fr]">
          {/* Image side */}
          <div className="relative h-56 shrink-0 overflow-hidden bg-[color:var(--card-soft)] sm:h-auto sm:min-h-full">
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

            <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
              {product.badge && product.badgeLabel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-pill ${badgeStyles[product.badge]}`}
                >
                  {product.badge === "promo" && <Flame className="size-3 fill-current" />}
                  {product.badge === "best" && <Star className="size-3 fill-current" />}
                  {product.badgeLabel}
                </span>
              )}
              {discount && (
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[color:var(--color-tomato-600)] shadow-pill backdrop-blur">
                  -{discount}%
                </span>
              )}
            </div>

            {product.rating && (
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <Star className="size-3 fill-[color:var(--color-amber-300)] text-[color:var(--color-amber-300)]" />
                <span className="num-tabular">{product.rating}</span>
                <span className="text-white/60">·</span>
                <span className="text-white/80">87 reseñas</span>
              </div>
            )}
          </div>

          {/* Info side */}
          <div className="flex flex-col p-5 sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-amber-600)]">
              {product.category}
            </p>
            <h2
              id={titleId}
              className="font-display mt-1.5 text-2xl leading-tight tracking-tight sm:text-3xl"
            >
              {product.name}
            </h2>

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="font-display num-tabular text-3xl leading-none">
                {formatBob(unitPrice)}
              </span>
              {product.comparePrice && (
                <span className="num-tabular text-base text-[color:var(--muted)] line-through">
                  {formatBob(product.comparePrice)}
                </span>
              )}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[color:var(--fg-soft)]">
              {product.description}
            </p>

            {product.variants && product.variants.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Tamaño
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  {product.variants.map((v, i) => {
                    const isActive = i === variantIdx;
                    const variantPrice = product.price + v.priceDelta;
                    return (
                      <button
                        key={v.name}
                        onClick={() => setVariantIdx(i)}
                        aria-pressed={isActive}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                          isActive
                            ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white shadow-pill"
                            : "border-[color:var(--line)] bg-[color:var(--card)] hover:border-[color:var(--color-amber-300)] hover:bg-[color:var(--color-amber-50)]"
                        }`}
                      >
                        <div className="text-sm font-semibold">{v.name}</div>
                        <div
                          className={`num-tabular text-[11px] ${
                            isActive ? "text-white/70" : "text-[color:var(--muted)]"
                          }`}
                        >
                          {formatBob(variantPrice)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6">
              <label
                htmlFor="kitchen-notes"
                className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]"
              >
                Notas para la cocina
              </label>
              <textarea
                id="kitchen-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin cebolla, salsa aparte…"
                className="mt-2 w-full resize-none rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3 text-sm outline-none transition focus:border-[color:var(--color-amber-400)] focus:bg-white"
              />
            </div>

            <div className="mt-6 grid gap-2.5 rounded-2xl bg-[color:var(--card-soft)] p-4 text-[13px]">
              <div className="flex items-center gap-2.5 text-[color:var(--fg-soft)]">
                <Clock className="size-4 text-[color:var(--color-amber-600)]" />
                <span>Entrega 30–45 min en {city}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[color:var(--fg-soft)]">
                <MessageCircle className="size-4 text-[color:var(--color-leaf-500)]" />
                <span>Confirmación por WhatsApp en menos de 5 min</span>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-5 mt-7 border-t border-[color:var(--line)] bg-[color:var(--card)] p-5 sm:-mx-7 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg)]">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Disminuir cantidad"
                    className="grid size-11 place-items-center rounded-full transition hover:bg-[color:var(--card-soft)] disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="num-tabular w-8 text-center text-sm font-semibold">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    aria-label="Aumentar cantidad"
                    className="grid size-11 place-items-center rounded-full transition hover:bg-[color:var(--card-soft)]"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                <button
                  disabled={!product.available}
                  onClick={onClose}
                  className="group flex h-12 flex-1 items-center justify-between gap-2 whitespace-nowrap rounded-full bg-[color:var(--color-bark-900)] pl-5 pr-2 text-sm font-semibold text-white shadow-pill transition-all hover:bg-[color:var(--color-amber-500)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShoppingBag className="size-4" />
                    Agregar
                  </span>
                  <span className="num-tabular rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    {formatBob(total)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
