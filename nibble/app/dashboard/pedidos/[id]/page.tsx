import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  User,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MapView } from "@/components/shared/MapsClient";
import { formatBob, formatWaPhone } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/orders/status";
import { OrderStatusPill } from "@/components/ui/OrderStatusPill";
import {
  StatusActions,
  PaymentActions,
} from "@/components/dashboard/pedidos/OrderActions";

export const metadata = {
  title: "Pedido · Madriguera Shop",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { store } = await requireStoreOwner();
  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id, storeId: store.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      customer: true,
    },
  });

  if (!order) notFound();

  const subtotal = Number(order.subtotal);
  const discount = Number(order.discountAmount);
  const deliveryFee = order.deliveryFee != null ? Number(order.deliveryFee) : null;
  const total = Number(order.total);

  const phoneOnly = formatWaPhone(order.customerPhone);

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />
      <main className="mx-auto max-w-5xl p-6 lg:p-8">
          <Link
            href="/dashboard/pedidos"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            <ChevronLeft className="size-4" /> Pedidos
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
                Pedido
              </p>
              <h1 className="font-display mt-1 text-3xl">
                #{order.orderNumber}
                <span className="ml-3 text-sm font-normal text-[color:var(--muted)]">
                  {order.createdAt.toLocaleString("es-BO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <OrderStatusPill status={order.status} className="px-2.5 py-1 text-xs" />
                <span className="rounded-full bg-[color:var(--bg)] px-2.5 py-1 text-xs text-[color:var(--fg-soft)]">
                  Pago: {PAYMENT_LABELS[order.paymentStatus]}
                </span>
              </div>
            </div>

            <Link
              href={`/${store.slug}/orden/${order.trackingToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1.5 text-xs hover:border-[color:var(--color-bark-300)]"
            >
              Ver como cliente <ExternalLink className="size-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Columna principal */}
            <div className="space-y-6">
              {/* Acciones de pago (si aplican) */}
              {(order.paymentStatus === "AWAITING_VERIFICATION" ||
                order.paymentStatus === "PENDING") && (
                <section className="rounded-3xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-5">
                  <h2 className="font-semibold text-[color:var(--color-amber-700)]">
                    Pago por verificar
                  </h2>
                  {order.paymentProofUrl ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                      <a
                        href={order.paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square overflow-hidden rounded-xl border border-[color:var(--line-strong)] bg-white p-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.paymentProofUrl}
                          alt="Comprobante"
                          className="size-full object-contain"
                        />
                      </a>
                      <div>
                        <p className="text-sm text-[color:var(--fg)]">
                          El cliente subió este comprobante. Verificá que el monto
                          (<strong className="num-tabular">{formatBob(total)}</strong>) y
                          el destinatario coincidan con tu cuenta.
                        </p>
                        <div className="mt-4">
                          <PaymentActions
                            orderId={order.id}
                            paymentStatus={order.paymentStatus}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-sm text-[color:var(--fg-soft)]">
                        Pago{" "}
                        {order.paymentMethod === "CASH_ON_DELIVERY"
                          ? "en efectivo a la entrega"
                          : "pendiente"}
                        . Cuando confirmes que recibiste el pago, marcalo como verificado.
                      </p>
                      <div className="mt-4">
                        <PaymentActions
                          orderId={order.id}
                          paymentStatus={order.paymentStatus}
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Items */}
              <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h2 className="font-semibold">Items del pedido</h2>
                <ul className="mt-4 divide-y divide-[color:var(--line)]">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[color:var(--bg)]">
                        {item.productImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.productImageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="size-4 text-[color:var(--muted)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-[color:var(--muted)]">
                          {item.variantName ? `${item.variantName} · ` : ""}×
                          {item.quantity} ·{" "}
                          {formatBob(Number(item.unitPrice))} c/u
                        </p>
                        {item.notes && (
                          <p className="mt-1 text-xs italic text-[color:var(--color-amber-700)]">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <span className="num-tabular text-sm font-medium">
                        {formatBob(Number(item.subtotal))}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-1.5 border-t border-[color:var(--line)] pt-4 text-sm">
                  <Row label="Subtotal" value={formatBob(subtotal)} />
                  {discount > 0 && (
                    <Row
                      label={
                        order.couponCode ? `Cupón ${order.couponCode}` : "Descuento"
                      }
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
                    <span className="font-display num-tabular">{formatBob(total)}</span>
                  </div>
                </div>

                {order.customerNotes && (
                  <div className="mt-4 rounded-xl bg-[color:var(--bg)] p-3 text-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Notas del cliente
                    </p>
                    <p className="mt-1">{order.customerNotes}</p>
                  </div>
                )}
              </section>

              {/* Historial */}
              {order.events.length > 0 && (
                <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
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
                            {ev.byUserName ? ` · ${ev.byUserName}` : " · sistema"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            {/* Sidebar derecho */}
            <aside className="space-y-4">
              {/* Acciones de estado */}
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="text-sm font-semibold">Cambiar estado</h3>
                <div className="mt-3">
                  <StatusActions
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                </div>
              </div>

              {/* Cliente */}
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="text-sm font-semibold">Cliente</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--fg-soft)]">
                    <User className="size-4 text-[color:var(--muted)]" />
                    {order.customerName}
                  </div>
                  <div className="flex items-center gap-2 text-[color:var(--fg-soft)]">
                    <Phone className="size-4 text-[color:var(--muted)]" />
                    <span className="num-tabular">{order.customerPhone}</span>
                  </div>
                  {order.customerEmail && (
                    <div className="text-xs text-[color:var(--muted)]">
                      {order.customerEmail}
                    </div>
                  )}
                  {order.customer && order.customer.ordersCount > 1 && (
                    <p className="rounded-lg bg-[color:var(--bg)] p-2 text-xs text-[color:var(--fg-soft)]">
                      Cliente recurrente: {order.customer.ordersCount} pedidos
                    </p>
                  )}
                </div>
                <Link
                  href={`https://wa.me/${phoneOnly}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-medium text-white"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp al cliente
                </Link>
              </div>

              {/* Entrega */}
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="text-sm font-semibold">Entrega</h3>
                <div className="mt-3 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[color:var(--muted)]" />
                  <div>
                    <p>{order.deliveryAddress}</p>
                    {order.deliveryNote && (
                      <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                        Ref: {order.deliveryNote}
                      </p>
                    )}
                  </div>
                </div>
                {order.deliveryLat != null && order.deliveryLng != null && (
                  <div className="mt-4">
                    <MapView lat={order.deliveryLat} lng={order.deliveryLng} />
                  </div>
                )}
              </div>
            </aside>
        </div>
      </main>
    </>
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
