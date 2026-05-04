"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";

const NAV = [
  { href: "/tiendas", label: "Tiendas" },
  { href: "#industrias", label: "Industrias" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precio", label: "Precio" },
];

export function MarketingHeader() {
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
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  return (
    <header
      className={[
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Nibble inicio" className="-ml-1">
          <NibbleLogo />
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[color:var(--muted)] transition-colors hover:text-[color:var(--fg)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-sm text-[color:var(--fg)] transition hover:bg-[color:var(--color-bark-100)]/60 md:inline-flex"
          >
            Acceder
          </Link>
          <Link
            href="#precio"
            className="group hidden items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--color-bark-700)] md:inline-flex"
          >
            Empezar
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--card)] md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        className={[
          "md:hidden",
          "absolute inset-x-0 top-16 origin-top overflow-hidden border-b border-[color:var(--line)] bg-[color:var(--bg)] transition-all duration-300",
          open ? "max-h-[80vh] opacity-100" : "pointer-events-none max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="mx-auto max-w-6xl px-5 py-6">
          <ul className="flex flex-col divide-y divide-[color:var(--line)]">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-4 text-base"
                >
                  {n.label}
                  <ArrowRight className="size-4 text-[color:var(--muted)]" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-3 text-sm"
            >
              Acceder
            </Link>
            <Link
              href="#precio"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-3 text-sm font-medium text-white"
            >
              Empezar <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
