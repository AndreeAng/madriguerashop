import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Check, Clock, MessageCircle, MapPin, Package, ChefHat, Bike } from "lucide-react";
import { getStore } from "@/lib/mock/stores";
import { getProductsByStore } from "@/lib/mock/products";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { formatBob } from "@/lib/utils";

const steps = [
  { key: "NEW", label: "Recibido", icon: Check, desc: "Lo tenemos. La cocina lo está revisando." },
  { key: "CONFIRMED", label: "Confirmado", icon: Clock, desc: "Pago verificado. Empezamos a preparar." },
  { key: "PREPARING", label: "Preparando", icon: ChefHat, desc: "Tu pedido está en cocina." },
  { key: "IN_DELIVERY", label: "En camino", icon: Bike, desc: "El motorista salió hacia tu dirección." },
  { key: "DELIVERED", label: "Entregado", icon: Package, desc: "Disfrutá. Esperamos verte de nuevo." },
];

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug } = await params;
  const store = getStore(slug);
  if (!store) notFound();

  const products = getProductsByStore(slug);
  const items = [
    { product: products[0]!, quantity: 1, variant: "12 piezas", price: 45 },
    { product: products[3]!, quantity: 1, variant: null, price: 32 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal - 8 + 12;
  const currentStep = 2;

  return (
    <div>
      <StorefrontHeader store={store} cartCount={0} />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl border border-[color:var(--line)] bg-gradient-to-br from-[color:var(--color-amber-50)] to-[color:var(--card)] p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Pedido #1247
              </p>
              <h1 className="font-display mt-1 text-3xl">Estamos preparando tu pedido</h1>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Tiempo estimado: <strong className="text-[color:var(--fg)]">35–45 min</strong> · Confirmado a las 14:38
              </p>
            </div>
            <Link
              href="#"
              className="hidden items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-medium text-white md:inline-flex"
            >
              <MessageCircle className="size-3.5" />
              Hablar con {store.name}
            </Link>
          </div>

          <ol className="mt-8 space-y-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-4 rounded-2xl border p-4 transition ${
                    active
                      ? "border-[color:var(--color-amber-500)] bg-[color:var(--bg)]"
                      : done
                      ? "border-[color:var(--line)] bg-transparent"
                      : "border-[color:var(--line)] bg-transparent opacity-50"
                  }`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      done
                        ? "bg-[color:var(--color-leaf-500)] text-white"
                        : active
                        ? "bg-[color:var(--color-amber-500)] text-white"
                        : "bg-[color:var(--line)] text-[color:var(--muted)]"
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{s.label}</p>
                      {active && (
                        <span className="rounded-full bg-[color:var(--color-amber-500)] px-2 py-0.5 text-[10px] font-semibold text-white">
                          Ahora
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[color:var(--muted)]">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Resumen</h2>
            <ul className="mt-4 space-y-3">
              {items.map((it) => (
                <li key={it.product.slug} className="flex items-center gap-3">
                  <div className="relative size-12 overflow-hidden rounded-lg">
                    <Image src={it.product.image} alt="" fill className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.product.name}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {it.variant ? `${it.variant} · ` : ""}x{it.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{formatBob(it.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-[color:var(--line)] pt-4 text-base font-semibold">
              <span>Total</span>
              <span className="font-display text-xl">{formatBob(total)}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Entrega</h2>
            <div className="mt-4 flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-600)]">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Av. Pando #1234</p>
                <p className="text-xs text-[color:var(--muted)]">Cala Cala · {store.city}</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">Ref: Frente al kiosco azul, 2do piso</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[color:var(--bg)] p-4 text-sm">
              <p className="font-medium">Pago: QR Simple</p>
              <p className="text-xs text-[color:var(--color-leaf-600)]">✓ Comprobante verificado</p>
            </div>

            <Link
              href="#"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-medium text-white"
            >
              <MessageCircle className="size-4" />
              Hablar con {store.name}
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-[color:var(--muted)]">
          Guardá este link. Podés volver acá en cualquier momento para ver el estado de tu pedido.
        </div>
      </main>
    </div>
  );
}
