"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";
import { marketingFontClass } from "@/lib/fonts/marketing";

const NAV = [
  { href: "/tiendas", label: "Tiendas" },
  { href: "/#industrias", label: "Rubros" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#precio", label: "Precio" },
];

/**
 * `tone="dark"`: la página empieza con un bloque oscuro (la landing), así
 * que arriba de todo el header es transparente con texto claro. Al hacer
 * scroll, o con el menú abierto, pasa a fondo blanco en ambos tonos.
 */
export function MarketingHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const solid = scrolled || open;
  const onDark = tone === "dark" && !solid;

  return (
    <header
      className={[
        marketingFontClass,
        "sticky top-0 z-50 transition-[background-color,border-color,color] duration-300",
        solid
          ? "border-b border-[color:var(--line)] bg-white/90 text-mk-ink backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
        onDark ? "text-mk-on-ink" : "text-mk-ink",
      ].join(" ")}
    >
      <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between gap-[16px] px-[20px]">
        <Link
          href="/"
          aria-label="Madriguera Shop, inicio"
          className={`-ml-1 flex min-h-11 items-center ${onDark ? "[--fg:var(--color-mk-on-ink)]" : ""}`}
        >
          <NibbleLogo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-[4px] text-sm font-medium md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-[14px] transition-colors ${
                onDark
                  ? "text-mk-on-ink-soft hover:text-mk-on-ink"
                  : "text-mk-soft hover:text-mk-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-[8px]">
          <Link
            href="/login"
            className={`hidden min-h-[44px] items-center whitespace-nowrap rounded-full px-[16px] text-sm font-medium transition-colors md:inline-flex ${
              onDark ? "hover:bg-white/10" : "hover:bg-mk-paper-2"
            }`}
          >
            Acceder
          </Link>
          <Link
            href="/registro"
            className="group hidden min-h-[44px] items-center gap-[6px] whitespace-nowrap rounded-full bg-mk-magenta px-[20px] text-sm font-semibold text-white transition-colors hover:bg-mk-magenta-deep md:inline-flex"
          >
            Empezar
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mkt-mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex size-[44px] items-center justify-center rounded-full border md:hidden ${
              onDark ? "border-white/25" : "border-[color:var(--line-strong)] bg-white"
            }`}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      <div
        id="mkt-mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-[64px] border-b border-[color:var(--line)] bg-white text-mk-ink md:hidden"
      >
        <div className="mx-auto max-w-7xl px-5 pb-6 pt-2">
          <ul className="flex flex-col divide-y divide-[color:var(--line)]">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="mk-display-wide flex min-h-14 items-center justify-between text-2xl font-semibold"
                >
                  {n.label}
                  <ArrowRight aria-hidden="true" className="size-5 text-mk-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--line-strong)] text-sm font-semibold"
            >
              Acceder
            </Link>
            <Link
              href="/registro"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-mk-magenta text-sm font-semibold text-white"
            >
              Empezar <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
