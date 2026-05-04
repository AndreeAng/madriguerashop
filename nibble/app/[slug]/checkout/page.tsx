import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, QrCode, Banknote, MessageCircle, Upload } from "lucide-react";
import { getStore } from "@/lib/mock/stores";
import { getProductsByStore } from "@/lib/mock/products";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { formatBob } from "@/lib/utils";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = getStore(slug);
  if (!store) notFound();

  const all = getProductsByStore(slug);
  const cartItems = [
    { product: all[0]!, quantity: 1, variant: "12 piezas" },
    { product: all[3]!, quantity: 1, variant: null },
  ];
  const subtotal = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discount = 8;
  const delivery = 12;
  const total = subtotal - discount + delivery;

  return (
    <div>
      <StorefrontHeader store={store} cartCount={cartItems.length} />

      <nav className="mx-auto max-w-6xl px-4 pt-6 text-sm">
        <Link href={`/${slug}`} className="inline-flex items-center gap-1 text-[color:var(--muted)] hover:text-[color:var(--fg)]">
          <ChevronLeft className="size-4" /> Seguir comprando
        </Link>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <h1 className="font-display text-3xl">Finalizar pedido</h1>

          <Section step="1" title="Tus datos">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre completo" placeholder="Carla Mendoza" />
              <Field label="Teléfono" placeholder="+591 7XXX XXXX" defaultValue="+591 7" />
            </div>
            <Field label="Email (opcional)" placeholder="carla@email.com" />
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-[color:var(--color-amber-500)]" />
              <span>
                Crear cuenta para próximas compras (sumás puntos y rastreás todos tus pedidos)
              </span>
            </label>
          </Section>

          <Section step="2" title="Entrega">
            <div className="mb-3 flex gap-2">
              <Toggle label="Delivery" active />
              <Toggle label="Recoger en tienda" />
            </div>

            <div className="relative h-44 overflow-hidden rounded-2xl border border-[color:var(--line)]">
              <Image
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80"
                alt="Mapa"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="grid size-12 place-items-center rounded-full bg-[color:var(--color-amber-500)] text-white shadow-xl shadow-black/30">
                  <MapPin className="size-6" />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black">
                Cala Cala — zona detectada
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Dirección" defaultValue="Av. Pando #1234" />
              <Field label="Referencia" placeholder="Frente al kiosco azul, 2do piso" />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-[color:var(--bg)] px-4 py-3 text-sm">
              <span className="text-[color:var(--muted)]">Costo de envío en esta zona</span>
              <span className="font-semibold">{formatBob(delivery)}</span>
            </div>
          </Section>

          <Section step="3" title="Método de pago">
            <div className="grid gap-3 md:grid-cols-2">
              <PayCard
                icon={<QrCode className="size-5" />}
                title="QR Simple"
                desc="Pagás con tu app del banco. Subís el comprobante."
                active
              />
              <PayCard
                icon={<Banknote className="size-5" />}
                title="Contra entrega"
                desc="Pagás en efectivo cuando recibís el pedido."
              />
            </div>

            <div className="mt-4 grid gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 md:grid-cols-[180px_1fr]">
              <div className="aspect-square rounded-xl bg-white p-3">
                <div className="grid h-full place-items-center rounded-lg bg-[#000] text-white">
                  <QrCode className="size-16" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Escaneá el QR para pagar {formatBob(total)}</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Una vez pagado, sube el comprobante. Tu pedido se confirmará en menos de 30 min.
                </p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-[color:var(--color-bark-300)] bg-[color:var(--bg)] px-4 py-3 text-sm font-medium hover:border-[color:var(--color-bark-900)]">
                  <Upload className="size-4" />
                  Subir comprobante (JPG / PNG · máx 5 MB)
                </button>
              </div>
            </div>
          </Section>

          <Section step="4" title="Cupón (opcional)">
            <div className="flex gap-2">
              <input
                placeholder="Ingresá tu código"
                className="flex-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
              <button className="rounded-xl bg-[color:var(--color-bark-900)] px-5 text-sm font-medium text-white">
                Aplicar
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--color-leaf-600)]">
              ✓ Cupón <strong>BIENVENIDO10</strong> aplicado: −Bs 8,00
            </p>
          </Section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h3 className="font-semibold">Tu pedido</h3>
            <ul className="mt-4 divide-y divide-[color:var(--line)]">
              {cartItems.map((it) => (
                <li key={it.product.slug} className="flex gap-3 py-3">
                  <div className="relative size-14 overflow-hidden rounded-lg">
                    <Image src={it.product.image} alt="" fill className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.product.name}</p>
                    {it.variant && <p className="text-xs text-[color:var(--muted)]">{it.variant}</p>}
                    <p className="mt-1 text-xs text-[color:var(--muted)]">x{it.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{formatBob(it.product.price * it.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-[color:var(--line)] pt-4 text-sm">
              <Row label="Subtotal" value={formatBob(subtotal)} />
              <Row label="Descuento (BIENVENIDO10)" value={`−${formatBob(discount)}`} accent="leaf" />
              <Row label="Envío" value={formatBob(delivery)} />
              <div className="flex justify-between border-t border-[color:var(--line)] pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="font-display text-2xl">{formatBob(total)}</span>
              </div>
            </div>

            <Link
              href={`/${slug}/orden/abc123`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3.5 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              <MessageCircle className="size-4" />
              Confirmar y avisar por WhatsApp
            </Link>

            <p className="mt-3 text-center text-xs text-[color:var(--muted)]">
              Al confirmar aceptás los Términos de {store.name}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-7 place-items-center rounded-full bg-[color:var(--color-bark-900)] text-xs font-semibold text-white">
          {step}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Field({ label, placeholder, defaultValue }: { label: string; placeholder?: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <input
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] px-4 py-2.5 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
      />
    </label>
  );
}

function Toggle({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`flex-1 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
          : "border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
      }`}
    >
      {label}
    </button>
  );
}

function PayCard({ icon, title, desc, active }: { icon: React.ReactNode; title: string; desc: string; active?: boolean }) {
  return (
    <button
      className={`rounded-2xl border p-4 text-left transition ${
        active ? "border-[color:var(--color-amber-500)] bg-[color:var(--color-amber-50)]" : "border-[color:var(--line)] bg-[color:var(--bg)] hover:border-[color:var(--color-bark-300)]"
      }`}
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-[color:var(--color-bark-900)] text-white">{icon}</div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-[color:var(--muted)]">{desc}</p>
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "leaf" }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className={accent === "leaf" ? "text-[color:var(--color-leaf-600)]" : ""}>{value}</span>
    </div>
  );
}
