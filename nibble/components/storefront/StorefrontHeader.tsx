import Link from "next/link";
import Image from "next/image";
import { User, Menu, MapPin, Search } from "lucide-react";
import type { StoreView } from "@/lib/storefront/types";
import { storefrontCopy } from "@/lib/storefront/copy";
import { HeaderCartLink } from "./HeaderCartLink";

export function StorefrontHeader({ store, cartCount = 0 }: { store: StoreView; cartCount?: number }) {
  const copy = storefrontCopy(store.vertical);
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {/*
          En mobile no hay drawer lateral — el "menú" del storefront son las
          categorías que viven en el home. El botón antes era un <button> sin
          onClick (no hacía nada al tocarlo). Lo cambiamos por un Link que
          scrolea al bloque de categorías en el home; abre el menú real sin
          requerir un drawer completo.
        */}
        <Link
          href={`/${store.slug}#menu`}
          aria-label={copy.menuAriaLabel}
          className="grid size-11 place-items-center rounded-full text-[color:var(--ink)] transition hover:bg-[color:var(--card-soft)] md:hidden"
        >
          <Menu className="size-5" />
        </Link>

        <Link
          href={`/${store.slug}`}
          aria-label={`${store.name}, inicio`}
          className="flex items-center gap-2.5"
        >
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
            {store.isOpenNow && (
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[color:var(--color-leaf-500)] ring-2 ring-[color:var(--bg)]" />
            )}
          </div>
          <div className="hidden md:block">
            <div className="font-display text-[15px] leading-none tracking-tight">
              {store.name}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--muted)]">
              <MapPin className="size-3" /> {store.city}
            </div>
          </div>
        </Link>

        {/* Búsqueda: link al search page con form GET. Antes era un input
            decorativo (sin onChange ni submit). Ahora delega al server. */}
        <Link
          href={`/${store.slug}/buscar`}
          aria-label={`Buscar en ${store.name}`}
          className="ml-2 hidden h-10 flex-1 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--muted)] transition hover:border-[color:var(--color-bark-300)] md:inline-flex md:max-w-md"
        >
          <Search className="size-4" />
          <span>{copy.searchPlaceholder}</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href={`/${store.slug}/buscar`}
            aria-label="Buscar"
            className="grid size-11 place-items-center rounded-full text-[color:var(--ink)] transition hover:bg-[color:var(--card-soft)] md:hidden"
          >
            <Search className="size-5" />
          </Link>
          <Link
            href="/login"
            className="hidden h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[color:var(--fg-soft)] transition hover:bg-[color:var(--card-soft)] md:inline-flex"
          >
            <User className="size-4" /> Acceder
          </Link>
          <HeaderCartLink
            storeSlug={store.slug}
            vertical={store.vertical}
            initialCount={cartCount}
          />
        </div>
      </div>
    </header>
  );
}
