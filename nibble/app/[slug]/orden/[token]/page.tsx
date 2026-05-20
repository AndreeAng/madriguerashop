import { notFound } from "next/navigation";
import {
  Bike,
  Check,
  ChefHat,
  Clock,
  MapPin,
  Package,
  ShieldX,
} from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontData } from "@/lib/tenant/resolve";
import { toStoreView } from "@/lib/storefront/adapter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { WhatsAppContactLink } from "@/components/storefront/WhatsAppContactLink";
import { CustomerCancelOrder } from "@/components/storefront/CustomerCancelOrder";
import { MapView } from "@/components/shared/MapsClient";
import { formatBob, formatDateLong, formatWaPhone } from "@/lib/utils";
import { storefrontCopy } from "@/lib/storefront/copy";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
import {
  TRACKING_STEPS,
  STATUS_LABELS,
  PAYMENT_LABELS,
  trackingStepIndex,
} from "@/lib/orders/status";

const STEP_ICONS = {
  PENDING_PAYMENT: Clock,
  NEW: Check,
  CONFIRMED: Clock,
  PREPARING: ChefHat,
  IN_DELIVERY: Bike,
  DELIVERED: Package,
};

// Página con token privado (el link viaja por WhatsApp al cliente).
// Bloqueamos indexing y previews públicos.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const order = await db.order.findUnique({
    where: { trackingToken: token },
    select: { orderNumber: true, store: { select: { name: true, slug: true } } },
  });
  if (!order || order.store.slug !== slug) {
    return { title: "Pedido", robots: { index: false, follow: false } };
  }
  return {
    title: `Pedido #${order.orderNumber} · ${order.store.name}`,
    robots: { index: false, follow: false },
  };
}

// `cookies()` lee guest token; combinarlo con `revalidate` cachea respuestas
// entre usuarios. Forzamos dinámico — el cliente puede pollear si quiere.
export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  // Token sanity check antes del query: `generateTrackingToken` produce 22
  // chars base64url (16 bytes). Cualquier URL con un token mucho más largo o
  // con chars fuera de [A-Za-z0-9_-] no puede existir en DB y solo gasta
  // recursos haciendo el `findUnique`. Esto también protege de payloads de
  // varios KB en el parámetro de URL.
  if (token.length < 8 || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    notFound();
  }

  // Order + storefront data en paralelo. Antes `storeData` se cargaba después
  // del `order`, sumando un RTT a la DB innecesariamente (la order ya incluye
  // los campos básicos del store via el `include`, pero `storeData` trae
  // template/hours/plan que el header del storefront necesita).
  const [order, storeData] = await Promise.all([
    db.order.findUnique({
      where: { trackingToken: token },
      include: {
        items: true,
        events: { orderBy: { createdAt: "asc" } },
        store: {
          select: {
            slug: true,
            name: true,
            whatsappPhone: true,
            city: true,
            qrInstructions: true,
          },
        },
      },
    }),
    getStorefrontData(slug),
  ]);

  if (!order || order.store.slug !== slug) notFound();
  if (!storeData) notFound();

  const store = toStoreView(storeData, { hours: storeData.storeHours });

  const isCancelled = order.status === "CANCELLED";
  const currentStep = trackingStepIndex(order.status);

  const subtotal = Number(order.subtotal);
  const discount = Number(order.discountAmount);
  const deliveryFee = order.deliveryFee != null ? Number(order.deliveryFee) : null;
  const total = Number(order.total);

  // Copy del estado se cierne sobre el sustantivo "pedido/solicitud" del
  // vertical de la tienda.
  const copy = storefrontCopy(store.vertical);
  const headerCopy = isCancelled
    ? `${capitalize(copy.cartLabel)} fue cancelado`
    : order.status === "DELIVERED"
      ? `¡${capitalize(copy.orderSingular)} entregado!`
      : `Estamos preparando ${copy.cartLabel.toLowerCase()}`;

  const phoneOnly = formatWaPhone(order.store.whatsappPhone);

  return (
    <div>
      <StorefrontHeader store={store} cartCount={0} />

      <main className="mx-auto max-w-4xl px-4 py-10">
        {/* Hero */}
        <div
          className={`rounded-3xl border p-6 md:p-8 ${
            isCancelled
              ? "border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5"
              : "border-[color:var(--line)] bg-gradient-to-br from-[color:var(--color-amber-50)] to-[color:var(--card)]"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={`text-xs uppercase tracking-widest ${
                  isCancelled
                    ? "text-[color:var(--color-tomato-600)]"
                    : "text-[color:var(--color-amber-500)]"
                }`}
              >
                Pedido #{order.orderNumber}
              </p>
              <h1 className="font-display mt-1 text-3xl">{headerCopy}</h1>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Estado actual:{" "}
                <strong className="text-[color:var(--fg)]">
                  {STATUS_LABELS[order.status]}
                </strong>
                {" · "}
                Pago: <strong>{PAYMENT_LABELS[order.paymentStatus]}</strong>
              </p>
              {isCancelled && order.cancelReason && (
                <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm text-[color:var(--color-tomato-700)]">
                  Motivo: {order.cancelReason}
                </p>
              )}
            </div>
            <WhatsAppContactLink
              storeSlug={slug}
              trackingToken={token}
              phoneOnly={phoneOnly}
              label={`Hablar con ${order.store.name}`}
              className="hidden items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-medium text-white md:inline-flex"
            />
          </div>

          {/* Cancelación del cliente: solo si todavía no entró a preparación.
              Una vez `CONFIRMED` o más avanzado, el local ya empezó a trabajar
              y la cancelación debe ser coordinada por WhatsApp. */}
          {(order.status === "PENDING_PAYMENT" || order.status === "NEW") && (
            <div className="mt-4">
              <CustomerCancelOrder token={token} />
            </div>
          )}

          {/* Timeline */}
          {!isCancelled ? (
            <ol className="mt-8 space-y-3">
              {TRACKING_STEPS.map((step, i) => {
                const Icon = STEP_ICONS[step.key as keyof typeof STEP_ICONS];
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <li
                    key={step.key}
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
                        <p className="text-sm font-semibold">{step.label}</p>
                        {active && (
                          <span className="rounded-full bg-[color:var(--color-amber-500)] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Ahora
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[color:var(--muted)]">{step.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[color:var(--color-tomato-500)]/30 bg-white/60 p-4">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--color-tomato-500)] text-white">
                <ShieldX className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Pedido cancelado</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Si pagaste por QR, contacta a la tienda para gestionar el reembolso.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Resumen + Entrega */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Resumen</h2>
            <ul className="mt-4 space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[color:var(--bg)]">
                    {item.productImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.productImageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] uppercase text-[color:var(--muted)]">
                        ×{item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {item.variantName ? `${item.variantName} · ` : ""}×{item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-medium num-tabular">
                    {formatBob(Number(item.subtotal))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-[color:var(--line)] pt-4 text-sm">
              <Row label="Subtotal" value={formatBob(subtotal)} />
              {discount > 0 && (
                <Row
                  label={order.couponCode ? `Cupón ${order.couponCode}` : "Descuento"}
                  value={`-${formatBob(discount)}`}
                  accent="leaf"
                />
              )}
              {deliveryFee !== null && (
                <Row
                  label={deliveryFee === 0 ? "Envío (gratis)" : "Envío"}
                  value={formatBob(deliveryFee)}
                />
              )}
              <div className="flex justify-between border-t border-[color:var(--line)] pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="font-display text-xl num-tabular">
                  {formatBob(total)}
                </span>
              </div>
            </div>
          </div>

          {order.scheduledFor && (
            <div className="rounded-3xl border border-[color:var(--color-bark-300)] bg-[color:var(--color-bark-50)] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-bark-700)]">
                📅 Pedido programado
              </p>
              <p className="mt-2 font-display text-xl">
                {formatDateLong(order.scheduledFor)}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {order.deliveryAddress === "Recojo en local"
                  ? "Pasá a recoger en este horario."
                  : "Te entregamos en este horario."}
              </p>
            </div>
          )}

          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Entrega</h2>
            <div className="mt-4 flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-600)]">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{order.deliveryAddress}</p>
                {order.deliveryNote && (
                  <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                    Ref: {order.deliveryNote}
                  </p>
                )}
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  {order.store.city}
                </p>
              </div>
            </div>

            {/* Si el cliente marcó ubicación al hacer el pedido, le
                mostramos su pin en mapa — refuerza el feedback "sabemos
                exactamente a dónde llevar tu pedido". */}
            {order.deliveryLat != null && order.deliveryLng != null && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-[color:var(--muted)]">
                  Ubicación que marcaste:
                </p>
                <MapView
                  lat={order.deliveryLat}
                  lng={order.deliveryLng}
                  height={180}
                />
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-[color:var(--bg)] p-4 text-sm">
              <p className="font-medium">
                Pago: {PAYMENT_LABELS[order.paymentStatus]}
              </p>
              {order.paymentStatus === "VERIFIED" && (
                <p className="text-xs text-[color:var(--color-leaf-600)]">
                  ✓ Comprobante verificado
                </p>
              )}
              {order.paymentStatus === "AWAITING_VERIFICATION" && (
                <p className="text-xs text-[color:var(--muted)]">
                  La tienda está revisando tu comprobante.
                </p>
              )}
              {order.paymentStatus === "REJECTED" && order.paymentRejectedReason && (
                <p className="text-xs text-[color:var(--color-tomato-600)]">
                  Rechazado: {order.paymentRejectedReason}
                </p>
              )}
            </div>

            <WhatsAppContactLink
              storeSlug={slug}
              trackingToken={token}
              phoneOnly={phoneOnly}
              label={`Hablar con ${order.store.name}`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-medium text-white"
            />
          </div>
        </div>

        {/* Timeline de eventos */}
        {order.events.length > 0 && (
          <div className="mt-8 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h2 className="font-semibold">Historial</h2>
            <ol className="mt-4 space-y-3">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[color:var(--color-amber-500)]" />
                  <div className="flex-1">
                    <p>{ev.description}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {ev.createdAt.toLocaleString("es-BO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {ev.byUserName ? ` · ${ev.byUserName}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-[color:var(--muted)]">
          Guarda este link. Puedes volver aquí en cualquier momento para ver el estado del pedido.
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "leaf";
}) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--muted)]">{label}</span>
      <span
        className={`num-tabular ${
          accent === "leaf" ? "text-[color:var(--color-leaf-600)]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
