import Link from "next/link";
import { ArrowRight, Compass, MessageCircle } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";

const SUPPORT_WA = "59172201700";

export default function StoreNotFound() {
  return (
    <>
      <MarketingHeader />
      <main className="grid min-h-[60vh] place-items-center px-5 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]">
            <Compass className="size-6" />
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Tienda no encontrada
          </p>
          <h1 className="font-display mt-3 text-4xl leading-tight md:text-5xl">
            Esta tienda no está disponible
          </h1>
          <p className="mt-4 text-[color:var(--muted)]">
            Puede que el link sea incorrecto, que la tienda esté temporalmente
            fuera de servicio, o que aún no esté pública.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/tiendas"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              Ver el directorio de tiendas
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={`https://wa.me/${SUPPORT_WA}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            >
              <MessageCircle className="size-4" />
              Contactar soporte
            </Link>
          </div>

          <p className="mt-8 text-xs text-[color:var(--muted)]">
            ¿Tienes una tienda?{" "}
            <Link href="/registro" className="font-medium text-[color:var(--fg)] hover:underline">
              Crea la tuya en 5 minutos
            </Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
