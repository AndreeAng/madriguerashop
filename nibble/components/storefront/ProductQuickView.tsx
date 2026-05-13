"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Minus, Plus, Star, Clock, MessageCircle, Flame, ShoppingBag, CalendarClock } from "lucide-react";
import Link from "next/link";
import type { StoreVertical } from "@prisma/client";
import type { ProductView } from "@/lib/storefront/types";
import { storefrontCopy } from "@/lib/storefront/copy";
import { formatBob } from "@/lib/utils";
import { addItemToCart } from "@/server/actions/cart";

const badgeStyles: Record<string, string> = {
  best: "bg-[color:var(--color-amber-500)] text-white",
  new: "bg-[color:var(--color-leaf-500)] text-white",
  promo: "bg-[color:var(--color-tomato-500)] text-white",
};

export function ProductQuickView({
  product,
  city,
  storeSlug,
  vertical,
  onClose,
}: {
  product: ProductView;
  city: string;
  storeSlug: string;
  vertical: StoreVertical;
  onClose: () => void;
}) {
  const copy = storefrontCopy(vertical);
  // Default a la primera variante disponible (no necesariamente la de
  // priceDelta=0, que podría estar agotada).
  const firstAvailable = product.variants?.findIndex((v) => v.available) ?? -1;
  const [variantIdx, setVariantIdx] = useState(firstAvailable >= 0 ? firstAvailable : 0);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const titleId = useId();
  // `useId` para el textarea de notas: antes era `id="kitchen-notes"` fijo,
  // lo que generaba duplicados si dos QuickView quedaban en el DOM (ej.
  // animación de salida + apertura encadenada). Los labels apuntaban al
  // primero, los lectores de pantalla leían mal.
  const notesId = useId();
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
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
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
  // Bloqueamos el add si el producto entero está no disponible o si la
  // variante seleccionada específica está agotada (caso clavo 11mm).
  const variantAvailable = variant ? variant.available : true;
  const canAdd = product.available && variantAvailable;

  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : null;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    startTransition(async () => {
      try {
        await addItemToCart({
          storeSlug,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity: qty,
          notes: notes.trim() || null,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar al carrito");
      }
    });
  };

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
                  {copy.variantLabel}
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  {product.variants.map((v, i) => {
                    const isActive = i === variantIdx;
                    const variantPrice = product.price + v.priceDelta;
                    const isDisabled = !v.available;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => !isDisabled && setVariantIdx(i)}
                        disabled={isDisabled}
                        aria-pressed={isActive}
                        aria-disabled={isDisabled}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                          isDisabled
                            ? "cursor-not-allowed border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--muted)] opacity-60"
                            : isActive
                              ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white shadow-pill"
                              : "border-[color:var(--line)] bg-[color:var(--card)] hover:border-[color:var(--color-amber-300)] hover:bg-[color:var(--color-amber-50)]"
                        }`}
                      >
                        <div
                          className={`text-sm font-semibold ${isDisabled ? "line-through" : ""}`}
                        >
                          {v.name}
                        </div>
                        <div
                          className={`num-tabular text-[11px] ${
                            isDisabled
                              ? "text-[color:var(--muted)]"
                              : isActive
                                ? "text-white/70"
                                : "text-[color:var(--muted)]"
                          }`}
                        >
                          {isDisabled ? "Agotado" : formatBob(variantPrice)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6">
              <label
                htmlFor={notesId}
                className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]"
              >
                {copy.productNotesLabel}
              </label>
              <textarea
                id={notesId}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={copy.productNotesPlaceholder}
                className="mt-2 w-full resize-none rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3 text-sm outline-none transition focus:border-[color:var(--color-amber-400)] focus:bg-white"
              />
            </div>

            <div className="mt-6 grid gap-2.5 rounded-2xl bg-[color:var(--card-soft)] p-4 text-[13px]">
              <div className="flex items-center gap-2.5 text-[color:var(--fg-soft)]">
                <Clock className="size-4 text-[color:var(--color-amber-600)]" />
                <span>
                  {copy.deliveryHint} en {city}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[color:var(--fg-soft)]">
                <MessageCircle className="size-4 text-[color:var(--color-leaf-500)]" />
                <span>Confirmación por WhatsApp en menos de 5 min</span>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-5 mt-7 border-t border-[color:var(--line)] bg-[color:var(--card)] p-5 sm:-mx-7 sm:p-7">
              {error && (
                <p className="mb-3 rounded-lg bg-[color:var(--color-tomato-50)] px-3 py-2 text-xs text-[color:var(--color-tomato-700)]">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-3">
                {product.isBookable ? (
                  // Servicios reservables: en lugar del flujo carrito (qty
                  // picker + "Agregar"), el QuickView lleva al cliente a
                  // la PDP donde está el calendario con día/hora. El
                  // QuickView no tiene espacio para un selector completo.
                  <Link
                    href={`/${storeSlug}/p/${product.slug}`}
                    className="group flex h-12 flex-1 items-center justify-between gap-2 whitespace-nowrap rounded-full bg-[color:var(--color-bark-900)] pl-5 pr-2 text-sm font-semibold text-white shadow-pill transition-all hover:bg-[color:var(--color-amber-500)] active:scale-[0.98]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock className="size-4" />
                      Ver horarios y reservar
                    </span>
                    <span className="num-tabular rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                      {formatBob(product.price)}
                    </span>
                  </Link>
                ) : (
                  <>
                    <div className="flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg)]">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        disabled={qty <= 1 || pending}
                        aria-label="Disminuir cantidad"
                        className="grid size-11 place-items-center rounded-full transition hover:bg-[color:var(--card-soft)] disabled:opacity-30"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="num-tabular w-8 text-center text-sm font-semibold">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.min(99, q + 1))}
                        disabled={pending}
                        aria-label="Aumentar cantidad"
                        className="grid size-11 place-items-center rounded-full transition hover:bg-[color:var(--card-soft)] disabled:opacity-30"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!canAdd || pending}
                      onClick={handleAdd}
                      className="group flex h-12 flex-1 items-center justify-between gap-2 whitespace-nowrap rounded-full bg-[color:var(--color-bark-900)] pl-5 pr-2 text-sm font-semibold text-white shadow-pill transition-all hover:bg-[color:var(--color-amber-500)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ShoppingBag className="size-4" />
                        {!product.available
                          ? "No disponible"
                          : !variantAvailable
                            ? "Variante agotada"
                            : pending
                              ? "Agregando…"
                              : "Agregar"}
                      </span>
                      <span className="num-tabular rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                        {formatBob(total)}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
