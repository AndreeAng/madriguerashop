import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MessageCircle,
  QrCode,
  Map as MapIcon,
  BarChart3,
  Globe,
  Zap,
  ShieldCheck,
  ChevronRight,
  Building2,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { HeroPhoneMock } from "@/components/marketing/PhoneMock";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { Faq } from "@/components/marketing/Faq";

const SUPPORT_WA = "59172201700";
const SUPPORT_WA_DISPLAY = "+591 7220 1700";

const industries = [
  {
    name: "Restaurantes",
    desc: "Menú con horarios, modificadores y combos. Wings, pizza, comida rápida, casual.",
    color: "#dc2626",
    accent: "bg-[#dc2626]/10 text-[#7f1d1d]",
    glyph: "R",
    sample: "/big-bite-wings",
    sampleLabel: "Big Bite Wings",
  },
  {
    name: "Food Trucks",
    desc: "One-page con ubicación del día y promo destacada. Pedido por WhatsApp.",
    color: "#d97706",
    accent: "bg-[#d97706]/10 text-[#92400e]",
    glyph: "F",
    sample: "/la-latita",
    sampleLabel: "La Latita",
  },
  {
    name: "Retail",
    desc: "Catálogo con stock, variantes y combos. Granolas, ropa, accesorios.",
    color: "#15803d",
    accent: "bg-[#15803d]/10 text-[#14532d]",
    glyph: "R",
    sample: "/nutriarte",
    sampleLabel: "Nutriarte",
  },
  {
    name: "Ferreterías",
    desc: "SKU, stock visible, cotización por WhatsApp. Para quien vende a profesionales.",
    color: "#92400e",
    accent: "bg-[#92400e]/10 text-[#78350f]",
    glyph: "T",
    sample: "/ferreteria-tunari",
    sampleLabel: "Ferretería Tunari",
  },
  {
    name: "Servicios",
    desc: "Reservas, cotizaciones, no vendes productos. Peluquerías, talleres, consultorios.",
    color: "#be185d",
    accent: "bg-[#be185d]/10 text-[#831843]",
    glyph: "S",
    sample: "/estudio-clara",
    sampleLabel: "Estudio Clara",
  },
];

const tickerItems = [
  "Setup 5 min",
  "Cobertura 9 departamentos",
  "Comisión por venta 0%",
  "Pagos QR / WhatsApp 100%",
  "Soporte español 24/7",
  "Diseño según tu rubro",
  "Tu propio dominio incluido",
  "Sin tarjeta de crédito",
];

const verses = [
  {
    n: "i",
    others: "Cobran en dólares y te cargan la conversión.",
    nibble: "Cobramos en bolivianos, los que tú vendes.",
    note: "Sin tipo de cambio, sin sorpresas a fin de mes.",
  },
  {
    n: "ii",
    others: "Su soporte no entiende qué es un comprobante de transferencia.",
    nibble: "Subes tu QR del banco. El pago es nativo desde el día 1.",
    note: "Funciona con todos los bancos de Bolivia.",
  },
  {
    n: "iii",
    others: "Tu marca pierde identidad en su template global.",
    nibble: "Te diseñamos un look propio según tu rubro.",
    note: "Una pizzería no se ve como una ferretería. La nuestra tampoco.",
  },
];

export default function HomePage() {
  return (
    <>
      <MarketingHeader />

      <main className="overflow-x-hidden">
        {/* ── §00 · MASTHEAD ────────────────────────────────────── */}
        <div className="border-b border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)] sm:text-[11px]">
            <span className="text-[color:var(--fg)]">Madriguera · No 01</span>
            <span className="hidden md:inline">
              Cobertura nacional · 9 departamentos
            </span>
            <span>
              Bs 500 <span className="text-[color:var(--muted-soft)]">· mes</span>
            </span>
          </div>
        </div>

        {/* ── §01 · HERO EDITORIAL ──────────────────────────────── */}
        <section className="relative">
          <div aria-hidden="true" className="absolute inset-0 -z-10 grain opacity-[0.06]" />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-[55vh] bg-gradient-to-b from-[color:var(--color-amber-100)]/45 to-transparent"
          />

          <div className="mx-auto max-w-7xl px-5 pb-20 pt-14 md:pt-24 md:pb-32">
            <div className="reveal-stagger">
              <div className="flex items-center gap-3">
                <p className="kicker">§ 01 — La promesa</p>
                <span className="hidden h-px flex-1 bg-[color:var(--line-strong)] sm:block" />
                <span className="stamp hidden sm:inline-block">Hecho en Bolivia</span>
              </div>

              <h1 className="font-display mt-7 text-[clamp(3.25rem,11vw,11rem)] font-semibold leading-[0.86] tracking-[-0.04em]">
                Tu negocio.
                <br />
                <span className="underline-amber">Como tú.</span>
                <br />
                <span className="text-[color:var(--muted)]">No como las demás.</span>
              </h1>

              <div className="mt-12 grid gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-16">
                <p className="drop-cap max-w-xl text-lg leading-[1.55] text-[color:var(--fg-soft)] md:text-xl">
                  La primera plataforma diseñada en Bolivia, para comerciantes bolivianos.
                  Cobras por <strong className="text-[color:var(--fg)]">QR del banco</strong>,
                  atiendes por <strong className="text-[color:var(--fg)]">WhatsApp</strong>, y
                  tu tienda se ve como las marcas grandes — sin pagar en dólares, sin
                  contratar agencia, sin entender de código.
                </p>

                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/registro"
                      className="press group inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-7 py-4 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
                    >
                      Empezar por Bs 500/mes
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                      />
                    </Link>
                    <Link
                      href="/big-bite-wings"
                      className="press group inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] bg-[color:var(--card)] px-7 py-4 text-sm font-medium hover:border-[color:var(--color-bark-300)]"
                    >
                      Ver una tienda real
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Sin tarjeta · Cancelas cuando quieras · 5 min de setup
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── §02 · LIVE TICKER ─────────────────────────────────── */}
        {/* `role="marquee"` no existe en ARIA — usamos `aria-hidden` porque
            es decorativo; el texto no aporta info de navegación al SR. */}
        <div
          aria-hidden="true"
          className="overflow-hidden border-y border-[color:var(--color-bark-700)] bg-[color:var(--color-bark-900)] py-4 text-[color:var(--color-cream-50)]"
        >
          <div className="flex animate-marquee whitespace-nowrap font-mono text-sm">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={`${i}-${item}`} className="flex items-center gap-3 px-8">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[color:var(--color-amber-400)]" />
                <span className="text-[color:var(--color-cream-100)]">{item}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── §03 · PHONE MOMENT ────────────────────────────────── */}
        <section className="relative py-24 md:py-36">
          <div aria-hidden="true" className="absolute inset-0 -z-10 grain opacity-[0.04]" />
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center md:gap-20">
              <div>
                <p className="kicker">§ 02 — El producto</p>
                <h2 className="font-display mt-5 text-5xl leading-[0.94] tracking-[-0.03em] md:text-7xl">
                  Tu tienda
                  <br />
                  no se parece
                  <br />
                  <span className="font-display-wonk">a ninguna otra.</span>
                </h2>
                <p className="mt-7 max-w-md text-lg leading-[1.55] text-[color:var(--fg-soft)]">
                  Cada tienda nace diseñada para tu rubro. Una pizzería no se ve como
                  una ferretería; un food truck no se atiende como una peluquería.
                  Tu tienda nace tuya — no de un template global pintado de azul.
                </p>
                <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-[color:var(--line)] pt-8 sm:max-w-md">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                      Tiempo de setup
                    </dt>
                    <dd className="font-display mt-1.5 num-tabular text-3xl">5 min</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                      Comisión por venta
                    </dt>
                    <dd className="font-display mt-1.5 num-tabular text-3xl">0%</dd>
                  </div>
                </dl>
              </div>

              <div className="relative flex items-center justify-center">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 mx-auto h-full w-full"
                  style={{
                    background:
                      "radial-gradient(50% 45% at 50% 50%, rgba(255,184,74,0.32), transparent 70%)",
                  }}
                />
                <HeroPhoneMock />
              </div>
            </div>
          </div>
        </section>

        {/* ── §04 · CÓMO SE VENDE ───────────────────────────────── */}
        <section
          id="como-funciona"
          className="border-t border-[color:var(--line)] bg-[color:var(--card-soft)]"
        >
          <div className="mx-auto max-w-6xl px-5 py-24 md:py-36">
            <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-20">
              <div>
                <p className="kicker">§ 03 — Cómo se vende, de verdad</p>
                <h2 className="font-display mt-5 text-4xl leading-[1.02] md:text-6xl">
                  Como ya vendes.
                  <br />
                  Pero con catálogo.
                </h2>
                <p className="mt-7 max-w-md text-[color:var(--fg-soft)]">
                  Nadie en Bolivia espera un checkout con tarjeta de crédito.
                  Nuestra plataforma respeta ese flujo — solo le pone una capa profesional encima.
                </p>
              </div>

              <ol className="relative space-y-10 border-l border-dashed border-[color:var(--color-bark-200)] pl-10">
                {[
                  {
                    k: "01",
                    title: "El cliente abre tu tienda",
                    desc: "Tu link madrigueras.shop/tutienda. Ve productos, fotos, precios — todo bonito, sin instalar nada.",
                  },
                  {
                    k: "02",
                    title: "Paga con QR como ya sabe",
                    desc: "Escanea tu QR del banco con su app. Sube el comprobante. El monto y el número están bloqueados — no se equivoca.",
                  },
                  {
                    k: "03",
                    title: "Tú confirmas en WhatsApp",
                    desc: "Suena tu teléfono. Llega el pedido completo, con dirección y total. Un toque y queda confirmado.",
                  },
                ].map((s) => (
                  <li key={s.k} className="relative">
                    <div className="absolute -left-[3.05rem] top-1 grid size-9 place-items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--bg)] font-mono text-xs">
                      {s.k}
                    </div>
                    <h3 className="font-display text-2xl leading-tight md:text-3xl">{s.title}</h3>
                    <p className="mt-2.5 max-w-md text-[color:var(--fg-soft)]">{s.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── §05 · EL PRODUCTO (Dashboard hero + grid) ────────── */}
        <section className="border-t border-[color:var(--line)] py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="kicker">§ 04 — Lo que tienes desde el día 1</p>
                <h2 className="font-display mt-5 text-4xl leading-[1.02] md:text-6xl">
                  Cero relleno.
                  <br />
                  <span className="underline-amber">Solo lo que vende.</span>
                </h2>
              </div>
              <p className="max-w-xs text-sm text-[color:var(--fg-soft)]">
                Cada feature nació de un comerciante boliviano pidiéndola.
                Ninguna salió de un brainstorm en San Francisco.
              </p>
            </div>

            <div className="mt-14 grid gap-3 md:grid-cols-3 md:grid-rows-[auto_auto] lg:gap-4">
              {/* Dashboard hero card */}
              <div className="group relative overflow-hidden rounded-3xl border border-[color:var(--line-strong)] bg-[color:var(--card)] p-7 md:col-span-2 md:row-span-2 md:p-9">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-amber-100)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-amber-700)]">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-[color:var(--color-amber-500)] animate-pulse-dot" />
                      En vivo
                    </span>
                    <h3 className="font-display mt-4 text-2xl md:text-3xl">
                      Panel de pedidos en tiempo real
                    </h3>
                    <p className="mt-2 max-w-md text-[color:var(--fg-soft)]">
                      Sonido, badge y notificación al toque. No se te escapa ninguno —
                      ni cuando estás cocinando.
                    </p>
                  </div>
                  <Zap className="size-6 text-[color:var(--color-amber-500)]" aria-hidden="true" />
                </div>
                <div className="mt-7">
                  <DashboardPreview />
                </div>
              </div>

              <BentoCard
                icon={<QrCode className="size-5" />}
                title="QR de tu banco"
                desc="Subes el QR una vez. Tu cliente paga, sube el comprobante, lo apruebas con un clic."
                meta="Funciona con todos los bancos"
              />
              <BentoCard
                icon={<MessageCircle className="size-5" />}
                title="WhatsApp con todo"
                desc="Cada pedido llega con items, dirección y total. Listo para confirmar."
                meta="No es un bot. Eres tú."
                tone="leaf"
              />
              <BentoCard
                icon={<MapIcon className="size-5" />}
                title="Zonas en mapa"
                desc="Pintas tu zona, defines tarifa, listo. Sin Excel, sin adivinar."
                meta="Cobertura por barrio"
              />
              <BentoCard
                icon={<BarChart3 className="size-5" />}
                title="Mapa de calor"
                desc="Miras dónde compran tus clientes. Dejas de tirar plata en publicidad ciega."
                meta="Datos, no corazonadas"
              />
              <BentoCard
                icon={<Globe className="size-5" />}
                title="Dominio propio"
                desc="Tu marca en su propia URL. Sin subdominios feos ni cuentas compartidas."
                meta="tutienda.bo incluido"
              />
            </div>
          </div>
        </section>

        {/* ── §06 · TU RUBRO ────────────────────────────────────── */}
        <section
          id="industrias"
          className="border-t border-[color:var(--line)] bg-[color:var(--color-cream-100)]/40 py-24 md:py-32"
        >
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-16">
              <div>
                <p className="kicker">§ 05 — Tu rubro tiene su flujo</p>
                <h2 className="font-display mt-5 text-4xl leading-[1.02] md:text-6xl">
                  Tu negocio
                  <br />
                  no es como los otros.
                  <br />
                  <span className="text-[color:var(--muted)]">Tu tienda tampoco.</span>
                </h2>
              </div>
              <p className="self-end text-[color:var(--fg-soft)] md:text-lg">
                Diseñamos un flujo distinto para cada tipo de negocio — porque
                vender alitas no es lo mismo que vender taladros, y un food
                truck no se atiende como una peluquería. Tu tienda nace pensada
                para tu rubro, no adaptada a la fuerza.
              </p>
            </div>

            {/* Featured industry + list */}
            <div className="mt-14 grid gap-5 md:grid-cols-[1.2fr_1fr]">
              {/* Feature card: Restaurantes */}
              <article className="lift group relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--line-strong)] bg-[color:var(--card)] p-8 hover:shadow-soft md:p-10">
                <div
                  aria-hidden="true"
                  className="absolute -right-12 -top-12 size-48 rounded-full opacity-15 blur-3xl"
                  style={{ background: industries[0]!.color }}
                />
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Caso de estudio
                  </span>
                  <span className="h-px flex-1 bg-[color:var(--line-strong)]" />
                </div>
                <div
                  aria-hidden="true"
                  className={`mt-6 grid size-14 place-items-center rounded-2xl text-xl font-bold ${industries[0]!.accent}`}
                >
                  {industries[0]!.glyph}
                </div>
                <h3 className="font-display mt-5 text-3xl md:text-4xl">{industries[0]!.name}</h3>
                <p className="mt-3 max-w-md text-[color:var(--fg-soft)]">{industries[0]!.desc}</p>

                <ul className="mt-7 grid grid-cols-2 gap-x-5 gap-y-2.5 max-w-md text-sm text-[color:var(--fg-soft)]">
                  {[
                    "Menú con horarios",
                    "Modificadores y combos",
                    "Zonas de delivery",
                    "QR del banco nativo",
                    "Sonido al pedido nuevo",
                    "Mapa de calor",
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-[color:var(--color-leaf-500)]"
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-[color:var(--line)] pt-6">
                  <Link
                    href={industries[0]!.sample!}
                    className="press group/cta inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
                  >
                    Ver {industries[0]!.sampleLabel}
                    <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5" />
                  </Link>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Cochabamba · Activa
                  </span>
                </div>
              </article>

              {/* List of remaining industries */}
              <ul className="divide-y divide-[color:var(--line)] rounded-3xl border border-[color:var(--line-strong)] bg-[color:var(--card)] overflow-hidden">
                {industries.slice(1).map((v) => (
                  <li key={v.name}>
                    <Link
                      href={v.sample ?? "/tiendas"}
                      className="group flex items-center gap-4 px-6 py-5 transition-colors duration-200 ease-[var(--ease-out-quart)] hover:bg-[color:var(--card-soft)]"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-11 place-items-center shrink-0 rounded-xl text-base font-bold ${v.accent}`}
                      >
                        {v.glyph}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-xl leading-tight">{v.name}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-[color:var(--fg-soft)]">
                          {v.desc}
                        </p>
                        {v.sampleLabel && (
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                            Ver demo: {v.sampleLabel} →
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-[color:var(--muted)] transition-[color,transform] duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5 group-hover:text-[color:var(--fg)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-[color:var(--fg-soft)]">
              <ShieldCheck aria-hidden="true" className="size-4 text-[color:var(--color-leaf-600)]" />
              <span>
                ¿No ves la tuya?{" "}
                <Link
                  href={`https://wa.me/${SUPPORT_WA}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[color:var(--fg)] underline decoration-[color:var(--color-amber-300)] decoration-2 underline-offset-4 hover:text-[color:var(--color-amber-600)]"
                >
                  Escríbenos al WhatsApp
                </Link>{" "}
                y la armamos para tu rubro.
              </span>
            </div>
          </div>
        </section>

        {/* ── §07 · DISCLAIMER (vs. el resto) ──────────────────── */}
        <section className="relative border-t border-[color:var(--color-bark-800)] bg-[color:var(--color-bark-900)] text-[color:var(--color-cream-50)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              background:
                "radial-gradient(800px 400px at 80% 20%, rgba(255,184,74,0.4), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-5 py-24 md:py-36">
            <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-16">
              <div>
                <p className="kicker !text-[color:var(--color-amber-300)]">
                  § 06 — Aviso a quien va a probarlo
                </p>
                <h2 className="font-display mt-5 text-4xl leading-[1.02] md:text-6xl">
                  Tres cosas
                  <br />
                  que las globales
                  <br />
                  <span className="font-display-wonk text-[color:var(--color-amber-300)]">
                    no van a decirte.
                  </span>
                </h2>
              </div>
              <p className="self-end text-[color:var(--color-bark-100)] md:text-lg">
                Las plataformas globales son grandes, pero no son tuyas.
                Te leemos lo que omiten — y te decimos qué hacemos diferente, sin
                vueltas.
              </p>
            </div>

            <div className="editorial-numbered mt-14 divide-y divide-[color:var(--color-bark-700)] border-y border-[color:var(--color-bark-700)]">
              {verses.map((v) => (
                <div
                  key={v.n}
                  className="grid gap-6 py-8 md:grid-cols-[5rem_1fr_1fr] md:items-baseline md:gap-10 md:py-10"
                >
                  <div className="font-display text-5xl text-[color:var(--color-amber-300)] md:text-7xl">
                    {v.n}.
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-tomato-400)]">
                      Otras dicen
                    </p>
                    <p className="mt-2 font-display text-2xl italic leading-tight text-[color:var(--color-bark-100)] opacity-70 md:text-3xl">
                      &ldquo;{v.others}&rdquo;
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-amber-300)]">
                      Madriguera dice
                    </p>
                    <p className="mt-2 font-display text-2xl leading-tight md:text-3xl">
                      {v.nibble}
                    </p>
                    <p className="mt-3 text-sm text-[color:var(--color-bark-100)]">{v.note}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-10 max-w-3xl text-[color:var(--color-bark-100)] md:text-lg">
              Madriguera Shop es el único hecho de cero para tu negocio: cobras en bolivianos, vives en{" "}
              <code className="rounded bg-[color:var(--color-bark-800)] px-1.5 py-0.5 font-mono text-xs">
                madrigueras.shop/tutienda
              </code>
              , y el soporte responde por WhatsApp desde Cochabamba.
            </p>
          </div>
        </section>

        {/* ── §08 · PRICING ─────────────────────────────────────── */}
        <section
          id="precio"
          className="border-t border-[color:var(--line)] py-24 md:py-32"
        >
          <div className="mx-auto max-w-5xl px-5">
            <div className="text-center">
              <p className="kicker">§ 07 — Suscripción</p>
              <h2 className="font-display mt-5 text-4xl leading-[1.02] md:text-7xl">
                Un plan.
                <br />
                <span className="underline-amber">Todo incluido.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[color:var(--fg-soft)] md:text-lg">
                Sin tiers, sin upsells, sin sorpresas. Pagas mensual o anual y
                tienes todo desde el primer día.
              </p>
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Sin tarjeta · Pagas por QR, transferencia o efectivo
              </p>
            </div>

            <div className="mt-14 grid items-stretch gap-4 md:grid-cols-[1fr_1.15fr]">
              {/* Monthly */}
              <div className="flex flex-col rounded-3xl border border-[color:var(--line-strong)] bg-[color:var(--card)] p-8">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Mensual
                  </p>
                  <span className="rounded-full bg-[color:var(--color-bark-50)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-bark-700)]">
                    Empezar simple
                  </span>
                </div>
                <div className="font-display mt-4 flex items-baseline gap-2 num-tabular text-6xl">
                  Bs 500
                  <span className="font-mono text-sm font-normal text-[color:var(--muted)]">/mes</span>
                </div>
                <ul className="mt-7 flex-1 space-y-3 text-sm">
                  {[
                    "Productos ilimitados",
                    "Diseño según tu industria",
                    "WhatsApp + QR de tu banco",
                    "Mapa de calor de pedidos",
                    "Soporte por WhatsApp",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <Check
                        aria-hidden="true"
                        className="size-4 text-[color:var(--color-leaf-500)]"
                      />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(
                    "Hola, quiero comenzar el plan mensual de Madriguera Shop.",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] px-5 py-3 text-sm font-medium hover:border-[color:var(--color-bark-300)]"
                >
                  Comenzar mensual
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>

              {/* Annual */}
              <div className="relative">
                <span className="absolute -top-3 left-8 z-10 rounded-full bg-[color:var(--color-amber-400)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-bark-900)] shadow-soft">
                  Ahorra Bs 1.500
                </span>
                <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] p-8 text-[color:var(--color-cream-50)]">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full opacity-30 blur-3xl"
                    style={{
                      background:
                        "radial-gradient(closest-side, var(--color-amber-300), transparent)",
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-amber-200)]">
                      Anual
                    </p>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium">
                      Recomendado
                    </span>
                  </div>
                  <div className="font-display mt-4 flex items-baseline gap-2 num-tabular text-7xl">
                    Bs 6.000
                    <span className="font-mono text-sm font-normal text-[color:var(--color-bark-200)]">
                      /año
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-[color:var(--color-bark-200)]">
                    Equivale a Bs 500/mes · pagas 12 al inicio
                  </p>
                  <ul className="mt-7 flex-1 space-y-3 text-sm">
                    {[
                      "Todo lo del plan mensual",
                      "Bs 1.500 de ahorro vs. mensual",
                      "Setup asistido (1 hora con un experto)",
                      "Migración desde otra plataforma",
                      "Dominio propio incluido",
                    ].map((t) => (
                      <li key={t} className="flex items-center gap-2.5">
                        <Check
                          aria-hidden="true"
                          className="size-4 text-[color:var(--color-amber-300)]"
                        />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(
                      "Hola, quiero comenzar el plan anual de Madriguera Shop.",
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press group mt-8 inline-flex items-center justify-center gap-1.5 rounded-full bg-[color:var(--color-amber-400)] px-5 py-3 text-sm font-semibold text-[color:var(--color-bark-900)] hover:bg-[color:var(--color-amber-300)]"
                  >
                    Quiero el anual
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-xl text-center text-xs text-[color:var(--muted)]">
              Cancelas cuando quieras.
              ¿Necesitas más info antes de decidir?{" "}
              <Link
                href={`https://wa.me/${SUPPORT_WA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[color:var(--fg)] underline decoration-[color:var(--color-amber-300)] decoration-2 underline-offset-4 hover:text-[color:var(--color-amber-600)]"
              >
                Escríbenos al {SUPPORT_WA_DISPLAY}
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ── §09 · FAQ ─────────────────────────────────────────── */}
        <section className="border-t border-[color:var(--line)] py-24 md:py-32">
          <div className="mx-auto max-w-4xl px-5">
            <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
              <div className="md:sticky md:top-28 md:self-start">
                <p className="kicker">§ 08 — Preguntas que casi todos hacen</p>
                <h2 className="font-display mt-5 text-4xl leading-[1.02] md:text-5xl">
                  Lo que vas a preguntar antes de empezar.
                </h2>
                <p className="mt-5 text-sm text-[color:var(--fg-soft)]">
                  ¿Falta algo? Escríbenos al WhatsApp y respondemos en minutos.
                </p>
                <Link
                  href={`https://wa.me/${SUPPORT_WA}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lift press group mt-6 inline-flex items-center gap-2.5 rounded-2xl border border-[color:var(--line-strong)] bg-[color:var(--card)] p-4 hover:shadow-soft"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#128C7E]/10 text-[#128C7E]">
                    <MessageCircle aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-left">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Soporte directo
                    </span>
                    <span className="block text-sm font-semibold">
                      {SUPPORT_WA_DISPLAY}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="ml-auto size-4 text-[color:var(--muted)] transition-[color,transform] duration-200 ease-[var(--ease-out-quart)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[color:var(--fg)]" />
                </Link>
              </div>
              <div>
                <Faq />
              </div>
            </div>
          </div>
        </section>

        {/* ── §10 · FIRMA / SIGN-OFF ────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-[color:var(--line-strong)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 100%, rgba(255,184,74,0.32), transparent 70%)",
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 grain opacity-[0.06]" />

          <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
            <div className="text-center">
              <p className="kicker">§ 09 — Tu turno</p>
              <h2 className="font-display mx-auto mt-6 max-w-5xl text-5xl leading-[0.92] tracking-[-0.03em] md:text-8xl lg:text-9xl">
                Hoy abres{" "}
                <span className="font-display-wonk underline-amber">con tienda.</span>
              </h2>
              <p className="mx-auto mt-8 max-w-xl text-[color:var(--fg-soft)] md:text-lg">
                Cinco minutos. Tu logo. Tres productos. Tu QR. Tu link.
                Y atiendes tu próximo pedido sin perder un peso en comisiones.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="#precio"
                  className="press group inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-7 py-4 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
                >
                  Ver planes y empezar
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href={`https://wa.me/${SUPPORT_WA}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Hablar al WhatsApp ${SUPPORT_WA_DISPLAY}`}
                  className="press group inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--line-strong)] bg-[color:var(--card)] px-7 py-4 text-sm font-medium hover:border-[color:var(--color-bark-300)]"
                >
                  <MessageCircle aria-hidden="true" className="size-4 text-[#128C7E]" />
                  Hablar al {SUPPORT_WA_DISPLAY}
                </Link>
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Sin tarjeta · Sin compromisos · Soporte desde Cochabamba
              </p>
            </div>

            <div
              aria-hidden="true"
              className="font-display -mb-8 mt-20 select-none text-center text-[22vw] leading-[0.85] tracking-tighter text-[color:var(--color-bark-900)]/[0.07]"
              style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}
            >
              nibble
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--line)] pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
              <span>Edición digital · 2026</span>
              <span className="hidden sm:inline">Hecho con cariño en Cochabamba</span>
              <span className="flex items-center gap-1.5">
                <Building2 aria-hidden="true" className="size-3" />
                {SUPPORT_WA_DISPLAY}
              </span>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}

/* ─── Inline helpers ───────────────────────────────────────────── */

function BentoCard({
  icon,
  title,
  desc,
  meta,
  tone = "amber",
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  meta?: string;
  tone?: "amber" | "leaf";
}) {
  const iconBg =
    tone === "leaf"
      ? "bg-[color:var(--color-leaf-500)]/12 text-[color:var(--color-leaf-600)]"
      : "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-700)]";
  return (
    <div className="lift group relative flex flex-col overflow-hidden rounded-3xl border border-[color:var(--line-strong)] bg-[color:var(--card)] p-6 hover:shadow-soft">
      <div
        aria-hidden="true"
        className={`inline-flex size-10 items-center justify-center rounded-xl ${iconBg}`}
      >
        {icon}
      </div>
      <h3 className="font-display mt-5 text-lg leading-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--fg-soft)]">{desc}</p>
      {meta && (
        <p className="mt-auto pt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
          <span className="block h-px w-8 bg-[color:var(--line-strong)] mb-3" aria-hidden="true" />
          {meta}
        </p>
      )}
    </div>
  );
}
