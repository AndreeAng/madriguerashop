import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { NibbleLogo } from "@/components/shared/Logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[color:var(--line)] bg-[color:var(--bg)]">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand block */}
          <div className="md:col-span-5">
            <NibbleLogo />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[color:var(--muted)]">
              Construido en Bolivia para emprendedores que venden por WhatsApp y
              merecen una tienda que se note.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 text-xs">
              <MapPin className="size-3.5 text-[color:var(--color-amber-500)]" />
              Cochabamba · Bolivia
            </div>
          </div>

          {/* Link columns */}
          <FooterCol
            title="Producto"
            links={[
              { label: "Tiendas en Nibble", href: "/tiendas" },
              { label: "Industrias", href: "#industrias" },
              { label: "Cómo funciona", href: "#como-funciona" },
              { label: "Precio", href: "#precio" },
            ]}
            className="md:col-span-3"
          />
          <FooterCol
            title="Empresa"
            links={[
              { label: "Acceder", href: "/login" },
              { label: "hola@nibble.bo", href: "mailto:hola@nibble.bo" },
              { label: "+591 7220 1700", href: "https://wa.me/59172201700" },
            ]}
            className="md:col-span-2"
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Términos", href: "#" },
              { label: "Privacidad", href: "#" },
              { label: "Estado del servicio", href: "#" },
            ]}
            className="md:col-span-2"
          />
        </div>

        {/* Decorative line */}
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--line)] pt-6 text-xs text-[color:var(--muted)] md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Nibble. Una empresa boliviana.</p>
          <p className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[color:var(--color-leaf-500)] animate-pulse-dot" />
            Todos los servicios operativos
          </p>
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
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-1 text-[color:var(--fg)] transition hover:text-[color:var(--color-amber-600)]"
            >
              {l.label}
              <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
