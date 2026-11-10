import Link from "next/link";
import { MapPin } from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";
import { marketingFontClass } from "@/lib/fonts/marketing";

export function MarketingFooter() {
  return (
    <footer className={`${marketingFontClass} bg-mk-ink text-mk-on-ink`}>
      <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <span className="[--fg:var(--color-mk-on-ink)]">
              <NibbleLogo />
            </span>
            <p className="mt-5 max-w-sm leading-relaxed text-mk-on-ink-soft">
              Construido en Bolivia para emprendedores que venden por WhatsApp y merecen una
              tienda que se note.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-mk-on-ink-soft">
              <MapPin aria-hidden="true" className="size-4 text-mk-saffron" />
              Cochabamba, Bolivia
            </p>
          </div>

          <FooterCol
            title="Producto"
            links={[
              { label: "Tiendas en madriguera·shop", href: "/tiendas" },
              { label: "Rubros", href: "/#industrias" },
              { label: "Cómo funciona", href: "/#como-funciona" },
              { label: "Precio", href: "/#precio" },
            ]}
            className="md:col-span-3"
          />
          <FooterCol
            title="Empresa"
            links={[
              { label: "Acceder", href: "/login" },
              { label: "hola@madrigueras.shop", href: "mailto:hola@madrigueras.shop" },
              { label: "+591 7220 1700", href: "https://wa.me/59172201700" },
            ]}
            className="md:col-span-2"
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Términos", href: "/terminos" },
              { label: "Privacidad", href: "/privacidad" },
            ]}
            className="md:col-span-2"
          />
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-sm text-mk-on-ink-soft md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Madriguera Shop · Operado por Nibble S.R.L. (Bolivia)</p>
          <p>Una empresa Nibble</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  className = "",
}: {
  title: string;
  links: { label: string; href: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold text-mk-on-ink">{title}</h2>
      <ul className="mt-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="inline-flex min-h-11 items-center text-mk-on-ink-soft transition-colors hover:text-mk-saffron"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
