import Link from "next/link";
import {
  Instagram,
  Facebook,
  MapPin,
  Clock,
  Phone,
  Banknote,
  QrCode,
} from "lucide-react";
import type { StoreView } from "@/lib/storefront/types";
import { NibbleLogo } from "@/components/shared/Logo";
import { CookieConsent } from "@/components/storefront/CookieConsent";

export function StorefrontFooter({ store }: { store: StoreView }) {
  return (
    <footer className="mt-20 border-t border-[color:var(--line)] bg-[color:var(--card)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-12">
        {/* Brand */}
        <div className="md:col-span-5">
          <div className="flex items-center gap-2.5">
            <div
              className="grid size-10 place-items-center overflow-hidden rounded-xl text-[13px] font-bold text-white shadow-pill"
              style={{ background: store.primaryColor }}
            >
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                store.logoEmoji
              )}
            </div>
            <div>
              <span className="font-display text-lg leading-none">{store.name}</span>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {store.city} · Bolivia
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[color:var(--muted)]">
            {store.description}
          </p>

          <div className="mt-5 flex items-center gap-2">
            {store.instagram && (
              <a
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--fg-soft)] transition hover:bg-[color:var(--color-amber-50)] hover:text-[color:var(--color-amber-600)]"
                href={`https://instagram.com/${store.instagram}`}
              >
                <Instagram className="size-4" />
              </a>
            )}
            {store.facebook && (
              <a
                aria-label="Facebook"
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-10 place-items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--fg-soft)] transition hover:bg-[color:var(--color-amber-50)] hover:text-[color:var(--color-amber-600)]"
                href={`https://facebook.com/${store.facebook}`}
              >
                <Facebook className="size-4" />
              </a>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="md:col-span-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Contacto
          </h4>
          <ul className="mt-4 space-y-3 text-sm text-[color:var(--fg-soft)]">
            {store.whatsapp && (
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-[color:var(--muted)]" />
                <span className="num-tabular">{store.whatsapp}</span>
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <MapPin className="size-4 text-[color:var(--muted)]" />
              {store.addressText ? `${store.addressText}, ${store.city}` : `${store.city}, Bolivia`}
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 text-[color:var(--muted)]" />
              {store.hoursSummary}
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link
              href={`/${store.slug}/sobre-nosotros`}
              className="text-[color:var(--muted)] hover:text-[color:var(--fg)] hover:underline"
            >
              Sobre nosotros
            </Link>
            <Link
              href={`/${store.slug}/contacto`}
              className="text-[color:var(--muted)] hover:text-[color:var(--fg)] hover:underline"
            >
              Contacto
            </Link>
          </div>
        </div>

        {/* Payment */}
        <div className="md:col-span-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Métodos de pago
          </h4>
          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm text-[color:var(--fg-soft)]">
            {store.acceptsQR && (
              <PayItem icon={<QrCode className="size-4" />} label="QR" hint="Todos los bancos" />
            )}
            {store.acceptsCashOnDelivery && (
              <PayItem icon={<Banknote className="size-4" />} label="Contra entrega" hint="Efectivo al recibir" />
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-[color:var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-5 text-xs text-[color:var(--muted)] md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} {store.name}. Todos los derechos reservados.</span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 transition hover:text-[color:var(--fg)]"
          >
            <span>Powered by</span>
            <NibbleLogo className="text-current" />
          </Link>
        </div>
      </div>
      {/* Banner de consentimiento de cookies analíticas — solo en
          storefront público (no en /dashboard ni /admin donde el owner
          ya autorizó tracking implícito al loguearse). */}
      <CookieConsent />
    </footer>
  );
}

function PayItem({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3">
      <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--card)] text-[color:var(--fg-soft)]">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium leading-tight text-[color:var(--fg)]">{label}</span>
        <span className="block text-[11px] text-[color:var(--muted)]">{hint}</span>
      </span>
    </li>
  );
}
