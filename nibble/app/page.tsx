import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCheck,
  Globe,
  Map as MapIcon,
  MessageCircle,
  QrCode,
  Zap,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { Faq } from "@/components/marketing/Faq";
import { OrderScene } from "@/components/marketing/landing/OrderScene";
import { StoreSwitcher } from "@/components/marketing/landing/StoreSwitcher";
import { marketingFontClass } from "@/lib/fonts/marketing";

const SUPPORT_WA = "59172201700";
const SUPPORT_WA_DISPLAY = "+591 7220 1700";
const waLink = (text?: string) =>
  `https://wa.me/${SUPPORT_WA}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

const proof = [
  "0% de comisión por venta",
  "Bs 500 al mes, todo incluido",
  "QR de cualquier banco boliviano",
  "Soporte por WhatsApp desde Cochabamba",
];

const steps = [
  {
    title: "El cliente abre tu tienda",
    desc: "Tu link madrigueras.shop/tutienda. Ve productos, fotos y precios, sin instalar nada.",
  },
  {
    title: "Paga con QR como ya sabe",
    desc: "Escanea tu QR del banco con su app y sube el comprobante. El monto está bloqueado: no se equivoca.",
  },
  {
    title: "Tú confirmas en WhatsApp",
    desc: "Suena tu teléfono. Llega el pedido completo, con dirección y total. Un toque y queda confirmado.",
  },
];

const features = [
  {
    icon: Zap,
    title: "Panel de pedidos en tiempo real",
    desc: "Sonido, badge y notificación al toque. No se te escapa ninguno, ni cuando estás cocinando.",
  },
  {
    icon: QrCode,
    title: "QR de tu banco",
    desc: "Subes el QR una vez. Tu cliente paga, sube el comprobante y lo apruebas con un clic.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp con todo",
    desc: "Cada pedido llega con ítems, dirección y total. No es un bot: eres tú.",
  },
  {
    icon: MapIcon,
    title: "Zonas en mapa",
    desc: "Pintas tu zona, defines la tarifa y listo. Sin Excel, sin adivinar.",
  },
  {
    icon: BarChart3,
    title: "Mapa de calor",
    desc: "Ves dónde compran tus clientes y dejas de gastar en publicidad a ciegas.",
  },
  {
    icon: Globe,
    title: "Dominio propio",
    desc: "Tu marca en su propia URL, incluido en el plan anual.",
  },
];

const verses = [
  {
    others: "Cobran en dólares y te cargan la conversión.",
    ours: "Cobramos en bolivianos, los que tú vendes.",
    note: "Sin tipo de cambio, sin sorpresas a fin de mes.",
  },
  {
    others: "Su soporte no entiende qué es un comprobante de transferencia.",
    ours: "Subes tu QR del banco. El pago es nativo desde el día uno.",
    note: "Funciona con cualquier QR bancario boliviano.",
  },
  {
    others: "Tu marca pierde identidad en su plantilla global.",
    ours: "Tu tienda nace con un look propio según tu rubro.",
    note: "Una pizzería no se ve como una ferretería.",
  },
];

export default function HomePage() {
  return (
    <div className={`${marketingFontClass} bg-white`}>
      <MarketingHeader tone="dark" />

      <main id="main-content" className="overflow-x-clip">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative -mt-16 overflow-hidden bg-mk-ink pt-16 text-mk-on-ink">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_85%_10%,rgba(212,20,90,0.28),transparent_60%)]"
          />
          <div className="relative mx-auto grid max-w-7xl gap-16 px-5 pb-20 pt-14 md:pt-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pb-28">
            <div>
              <h1 className="mk-display text-[clamp(3.4rem,10vw,8.5rem)] font-bold leading-[0.88]">
                <span className="mk-rise block">Tu negocio.</span>
                <span className="mk-rise block text-mk-saffron [animation-delay:90ms]">
                  Como tú.
                </span>
                <span className="mk-rise block text-mk-on-ink-soft [animation-delay:180ms]">
                  No como las demás.
                </span>
              </h1>

              <p className="mk-rise mt-8 max-w-xl text-lg leading-relaxed text-mk-on-ink-soft [animation-delay:280ms] md:text-xl">
                Tu tienda online, hecha para Bolivia. Cobras por{" "}
                <strong className="font-semibold text-mk-on-ink">QR del banco</strong>, atiendes
                por <strong className="font-semibold text-mk-on-ink">WhatsApp</strong> y te ves
                como las marcas grandes, sin pagar en dólares ni contratar agencia.
              </p>

              <div className="mk-rise mt-10 flex flex-col gap-3 [animation-delay:360ms] sm:flex-row">
                <Link
                  href="/registro"
                  className="press group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-mk-magenta px-8 text-base font-semibold text-white transition-colors hover:bg-mk-magenta-deep"
                >
                  Empezar por Bs 500/mes
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/big-bite-wings"
                  className="press group inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/25 px-8 text-base font-semibold text-mk-on-ink transition-colors hover:border-white/60 hover:bg-white/5"
                >
                  Ver una tienda real
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
              <p className="mk-rise mt-5 text-sm text-mk-on-ink-soft [animation-delay:420ms]">
                Sin tarjeta · Cancelas cuando quieras · 5 min de setup
              </p>
            </div>

            <div className="mk-rise [animation-delay:200ms] lg:justify-self-end">
              <OrderScene />
            </div>
          </div>

          <div className="relative border-t border-white/10">
            <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-10 gap-y-3 px-5 py-6 text-sm text-mk-on-ink-soft">
              {proof.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-4 text-mk-saffron" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Rubros: la misma plataforma, cinco tiendas distintas ─── */}
        <section id="industrias" className="scroll-mt-20 py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5">
            <div className="mk-reveal max-w-3xl">
              <h2 className="mk-display text-[clamp(2.6rem,6.5vw,5.5rem)] font-bold leading-[0.92]">
                Cinco rubros.
                <br />
                <span className="text-mk-magenta">Cinco tiendas</span> que no se parecen.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-mk-soft">
                Vender alitas no es lo mismo que vender taladros. Elige un rubro y mira cómo
                cambia la tienda: color, catálogo y forma de comprar.
              </p>
            </div>
            <div className="mt-16">
              <StoreSwitcher />
            </div>
            <p className="mt-14 text-mk-soft">
              ¿No ves el tuyo?{" "}
              <Link
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-mk-ink underline decoration-mk-magenta decoration-2 underline-offset-4 hover:text-mk-magenta"
              >
                Escríbenos al WhatsApp
              </Link>{" "}
              y la armamos para tu rubro.
            </p>
          </div>
        </section>

        {/* ── Cómo se vende ──────────────────────────────────────── */}
        <section id="como-funciona" className="scroll-mt-20 bg-mk-paper-2 py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5">
            <div className="mk-reveal grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
              <h2 className="mk-display text-[clamp(2.6rem,6.5vw,5.5rem)] font-bold leading-[0.92]">
                Como ya vendes.
                <br />
                Pero con catálogo.
              </h2>
              <p className="max-w-md text-lg leading-relaxed text-mk-soft md:justify-self-end">
                Nadie en Bolivia espera un checkout con tarjeta de crédito. Madriguera respeta
                ese flujo y le pone una capa profesional encima.
              </p>
            </div>

            <ol className="mt-16 grid gap-5 md:grid-cols-3">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className="mk-reveal flex flex-col rounded-[2rem] bg-white p-6 md:p-7"
                >
                  <div className="flex items-center gap-3">
                    <span className="mk-display-wide grid size-11 place-items-center rounded-full bg-mk-ink text-base font-semibold text-white num-tabular">
                      {i + 1}
                    </span>
                    {i < steps.length - 1 && (
                      <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--line-strong)] max-md:hidden" />
                    )}
                  </div>
                  <h3 className="mk-display-wide mt-6 text-2xl font-semibold leading-tight">
                    {s.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-mk-soft">{s.desc}</p>
                  <div aria-hidden="true" className="mt-8 flex-1 content-end">
                    <StepVisual step={i} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── El panel ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-mk-ink py-24 text-mk-on-ink md:py-36">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_90%_0%,rgba(212,20,90,0.18),transparent_60%)]"
          />
          <div className="relative mx-auto max-w-7xl px-5">
            <div className="mk-reveal max-w-3xl">
              <h2 className="mk-display text-[clamp(2.6rem,6.5vw,5.5rem)] font-bold leading-[0.92]">
                Cero relleno.
                <br />
                <span className="text-mk-saffron">Solo lo que vende.</span>
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-mk-on-ink-soft">
                Cada función nació de un comerciante boliviano pidiéndola.
              </p>
            </div>

            <div className="mk-reveal mt-16 rounded-[2rem] bg-white/5 p-2 ring-1 ring-white/10 md:p-3">
              {/* Vista ilustrativa: sin foco ni lectura, sus botones no hacen nada. */}
              <div className="text-mk-ink" aria-hidden="true" inert>
                <DashboardPreview />
              </div>
            </div>

            <ul className="mt-16 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title} className="mk-reveal border-t border-white/15 pt-6">
                    <Icon aria-hidden="true" className="size-6 text-mk-saffron" />
                    <h3 className="mk-display-wide mt-4 text-xl font-semibold">{f.title}</h3>
                    <p className="mt-2 leading-relaxed text-mk-on-ink-soft">{f.desc}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Frente a las globales ──────────────────────────────── */}
        <section className="py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5">
            <h2 className="mk-reveal mk-display max-w-4xl text-[clamp(2.6rem,6.5vw,5.5rem)] font-bold leading-[0.92]">
              Tres cosas que las globales{" "}
              <span className="text-mk-magenta">no van a decirte.</span>
            </h2>

            <div className="mt-16 border-b border-[color:var(--line-strong)]">
              {verses.map((v) => (
                <div
                  key={v.ours}
                  className="mk-reveal grid gap-4 border-t border-[color:var(--line-strong)] py-10 md:grid-cols-2 md:gap-12 md:py-12"
                >
                  <p className="text-lg leading-snug text-mk-muted md:text-xl">
                    <span className="sr-only">Otras plataformas: </span>
                    <s className="decoration-mk-magenta/60 decoration-2">{v.others}</s>
                  </p>
                  <div>
                    <p className="mk-display-wide text-2xl font-semibold leading-tight md:text-3xl">
                      <span className="sr-only">Madriguera: </span>
                      {v.ours}
                    </p>
                    <p className="mt-2 text-mk-soft">{v.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Precio ─────────────────────────────────────────────── */}
        <section id="precio" className="scroll-mt-20 bg-mk-paper-2 py-24 md:py-36">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mk-reveal text-center">
              <h2 className="mk-display text-[clamp(2.6rem,7vw,6rem)] font-bold leading-[0.92]">
                Un plan. <span className="text-mk-magenta">Todo incluido.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-mk-soft">
                Sin niveles ni sorpresas. Pagas mensual o anual por QR, transferencia o
                efectivo, y tienes todo desde el primer día.
              </p>
            </div>

            <div className="mt-16 grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="mk-reveal flex flex-col rounded-[2rem] bg-white p-8 md:p-10">
                <p className="text-sm font-semibold text-mk-muted">Mensual</p>
                <p className="mk-display mt-3 flex items-baseline gap-2 text-7xl font-bold num-tabular">
                  Bs 500
                  <span className="text-base font-medium tracking-normal text-mk-muted">/mes</span>
                </p>
                <ul className="mt-8 flex-1 space-y-3.5">
                  {[
                    "Productos ilimitados",
                    "Diseño según tu rubro",
                    "WhatsApp + QR de tu banco",
                    "Mapa de calor de pedidos",
                    "Soporte por WhatsApp",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-3">
                      <Check aria-hidden="true" className="size-5 shrink-0 text-mk-leaf" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href={waLink("Hola, quiero comenzar el plan mensual de Madriguera Shop.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press mt-10 inline-flex min-h-13 items-center justify-center gap-2 rounded-full border-2 border-mk-ink px-6 font-semibold transition-colors hover:bg-mk-ink hover:text-white"
                >
                  Comenzar mensual
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>

              <div className="mk-reveal relative flex flex-col overflow-hidden rounded-[2rem] bg-mk-ink p-8 text-mk-on-ink md:p-10">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(212,20,90,0.5),transparent)] blur-2xl"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-mk-on-ink-soft">Anual</p>
                  <span className="rounded-full bg-mk-saffron px-3 py-1 text-xs font-bold text-mk-ink">
                    Ahorras Bs 1.500
                  </span>
                </div>
                <p className="mk-display relative mt-3 flex items-baseline gap-2 text-7xl font-bold num-tabular">
                  Bs 6.000
                  <span className="text-base font-medium tracking-normal text-mk-on-ink-soft">/año</span>
                </p>
                <p className="relative mt-2 text-sm text-mk-on-ink-soft">
                  Equivale a Bs 500/mes · pagas los 12 al inicio
                </p>
                <ul className="relative mt-8 flex-1 space-y-3.5">
                  {[
                    "Todo lo del plan mensual",
                    "Setup asistido (1 hora con un experto)",
                    "Migración desde otra plataforma",
                    "Dominio propio incluido",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-3">
                      <Check aria-hidden="true" className="size-5 shrink-0 text-mk-saffron" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href={waLink("Hola, quiero comenzar el plan anual de Madriguera Shop.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press group relative mt-10 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-mk-magenta px-6 font-semibold text-white transition-colors hover:bg-mk-magenta-deep"
                >
                  Quiero el anual
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>

            <p className="mx-auto mt-10 max-w-xl text-center text-sm text-mk-soft">
              Cancelas cuando quieras. ¿Más dudas antes de decidir?{" "}
              <Link
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-mk-ink underline decoration-mk-magenta decoration-2 underline-offset-4 hover:text-mk-magenta"
              >
                Escríbenos al {SUPPORT_WA_DISPLAY}
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section className="py-24 md:py-36">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-16">
            <div className="md:sticky md:top-28 md:self-start">
              <h2 className="mk-display text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[0.95]">
                Lo que vas a preguntar antes de empezar.
              </h2>
              <Link
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="press group mt-8 inline-flex min-h-11 items-center gap-3 rounded-full bg-mk-ink py-2 pl-2 pr-5 text-white"
              >
                <span className="grid size-9 place-items-center rounded-full bg-whatsapp text-mk-ink">
                  <MessageCircle aria-hidden="true" className="size-4" />
                </span>
                <span className="text-sm font-semibold">{SUPPORT_WA_DISPLAY}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            <Faq />
          </div>
        </section>

        {/* ── Cierre ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-mk-magenta text-white">
          <div className="relative mx-auto max-w-7xl px-5 pb-4 pt-24 md:pt-36">
            <h2 className="mk-reveal mk-display max-w-5xl text-[clamp(3.2rem,10vw,9rem)] font-bold leading-[0.86]">
              Hoy abres con tienda.
            </h2>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-white md:text-xl">
              Tu logo, tus productos, tu QR y tu link. Atiendes tu próximo pedido sin perder un
              peso en comisiones.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="press group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-mk-ink transition-colors hover:bg-mk-saffron"
              >
                Crear mi tienda
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-white/50 px-8 text-base font-semibold transition-colors hover:border-white hover:bg-white/10"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Hablar al {SUPPORT_WA_DISPLAY}
              </Link>
            </div>
            {/* Firma decorativa: SVG para que ocupe justo el ancho en cualquier pantalla. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 1000 215"
              className="pointer-events-none mt-20 block w-full select-none fill-mk-magenta-deep"
            >
              <text
                x="0"
                y="168"
                textLength="1000"
                lengthAdjust="spacingAndGlyphs"
                className="mk-display font-extrabold"
                fontSize="220"
              >
                madriguera
              </text>
            </svg>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/* Mini interfaces de cada paso de "Cómo se vende". Decorativas. */
function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--line)] bg-mk-paper-2 p-3">
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs text-mk-muted">
          <Globe className="size-3.5" />
          madrigueras.shop/<span className="font-semibold text-mk-ink">tutienda</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["#dc2626", "#d97706", "#15803d"].map((c) => (
            <div key={c} className="aspect-square rounded-xl" style={{ background: `${c}26` }}>
              <div className="m-2 h-1.5 w-2/3 rounded-full" style={{ background: c }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--line)] bg-mk-paper-2 p-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-white">
          <QrCode className="size-10 text-mk-ink" />
        </span>
        <div className="min-w-0">
          <p className="mk-display-wide text-2xl font-semibold num-tabular">Bs 145</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-mk-leaf-deep">
            <Check className="size-3.5" /> Comprobante subido
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-[#e7f6ec] p-4">
      <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-white p-3 text-sm shadow-sm">
        <p className="font-semibold">Pedido #1247 · Bs 145</p>
        <p className="mt-1 text-mk-soft">Combo Familiar · Cala Cala</p>
        <p className="mt-1.5 flex items-center justify-end gap-1 text-xs text-mk-muted">
          12:41 <CheckCheck className="size-3.5 text-[#1d9bf0]" />
        </p>
      </div>
      <div className="mt-2 w-fit rounded-full bg-mk-leaf-deep px-4 py-2 text-sm font-semibold text-white">
        Confirmar pedido
      </div>
    </div>
  );
}
