import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, User, Menu, MapPin } from "lucide-react";
import type { StoreView } from "@/lib/storefront/types";

export function StorefrontHeader({ store, cartCount = 0 }: { store: StoreView; cartCount?: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <button
          className="grid size-10 place-items-center rounded-full text-[color:var(--ink)] transition hover:bg-[color:var(--card-soft)] md:hidden"
          aria-label="Menú"
        >
          <Menu className="size-5" />
        </button>

        <Link href={`/${store.slug}`} className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className="grid size-10 place-items-center overflow-hidden rounded-xl text-[13px] font-bold text-white shadow-pill ring-2 ring-white/40"
              style={{ background: store.primaryColor }}
            >
              {store.logoUrl ? (
                <Image
                  src={store.logoUrl}
                  alt={`${store.name} logo`}
                  width={40}
                  height={40}
                  className="size-full object-cover"
                />
              ) : (
                store.logoEmoji
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[color:var(--color-leaf-500)] ring-2 ring-[color:var(--bg)]" />
          </div>
          <div className="hidden md:block">
            <div className="font-display text-[15px] leading-none tracking-tight">
              {store.name}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[color:var(--muted)]">
              <MapPin className="size-3" /> {store.city}
            </div>
          </div>
        </Link>

        {/* Búsqueda removida: el input antes era decorativo (sin onChange ni
            submit). Volverá cuando exista una ruta /[slug]/search real. */}

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[color:var(--fg-soft)] transition hover:bg-[color:var(--card-soft)] md:inline-flex"
          >
            <User className="size-4" /> Acceder
          </Link>
          <Link
            href={`/${store.slug}/checkout`}
            aria-label={
              cartCount > 0
                ? `Carrito con ${cartCount} ${cartCount === 1 ? "producto" : "productos"}`
                : "Carrito vacío"
            }
            className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-[color:var(--color-bark-900)] pl-4 pr-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[color:var(--color-bark-800)] hover:scale-[1.02] active:scale-95"
          >
            <ShoppingBag aria-hidden className="size-4" />
            <span className="hidden sm:inline">Carrito</span>
            {cartCount > 0 && (
              <span
                aria-hidden
                className="grid size-5 place-items-center rounded-full bg-[color:var(--color-amber-400)] text-[11px] font-bold text-[color:var(--color-bark-900)] num-tabular"
              >
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
