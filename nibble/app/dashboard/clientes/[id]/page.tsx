import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Phone, ShoppingBag } from "lucide-react";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { formatBob, formatWaPhone } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/orders/status";
import { OrderStatusPill } from "@/components/ui/OrderStatusPill";
import { dashboardCopy } from "@/lib/dashboard/copy";

export const metadata = { title: "Cliente · Madriguera Shop" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { store } = await requireStoreOwner();
  const copy = dashboardCopy(store.vertical);
  const { id } = await params;

  // Una sola query con `include` — `customerId` ya implica pertenencia al
  // store porque `customer.id` fue validado por `storeId` arriba.
  const customer = await db.customer.findFirst({
    where: { id, storeId: store.id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { items: true } } },
      },
    },
  });

  if (!customer) notFound();

  const orders = customer.orders;

  const phoneDigits = formatWaPhone(customer.phone);

  return (
    <main className="mx-auto max-w-4xl p-6 lg:p-8">
          <Link
            href="/dashboard/clientes"
            className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            <ChevronLeft className="size-4" /> Clientes
          </Link>

          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
            <div>
              <h1 className="font-display text-3xl">{customer.fullName}</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Cliente desde{" "}
                {customer.createdAt.toLocaleDateString("es-BO", {
                  dateStyle: "medium",
                  timeZone: "America/La_Paz",
                })}
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <Stat
                  label={`${copy.ordersLabel} totales`}
                  value={String(customer.ordersCount)}
                  hint={
                    customer.ordersCount > 1
                      ? "Cliente recurrente"
                      : customer.ordersCount === 1
                      ? `${copy.orderSingular === "solicitud" ? "Primera" : "Primer"} ${copy.orderSingular}`
                      : `Sin ${copy.ordersLabel.toLowerCase()}`
                  }
                />
                <Stat
                  label="Total gastado"
                  value={formatBob(Number(customer.totalSpent))}
                />
                <Stat
                  label={`Último ${copy.orderSingular}`}
                  value={
                    customer.lastOrderAt
                      ? customer.lastOrderAt.toLocaleDateString("es-BO", {
                          day: "2-digit",
                          month: "short",
                          timeZone: "America/La_Paz",
                        })
                      : "—"
                  }
                />
              </div>

              {/* Order history */}
              <section className="mt-8">
                <h2 className="font-semibold">Histórico de {copy.ordersLabel.toLowerCase()}</h2>
                {orders.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)]">
                    Sin {copy.ordersLabel.toLowerCase()} registrados.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {orders.map((o) => {
                      const c = STATUS_COLORS[o.status];
                      return (
                        <li key={o.id}>
                          <Link
                            href={`/dashboard/pedidos/${o.id}`}
                            className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 transition hover:border-[color:var(--color-bark-300)]"
                          >
                            <div
                              className={`grid size-9 shrink-0 place-items-center rounded-lg ${c.bg} ${c.fg}`}
                            >
                              <ShoppingBag className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold num-tabular">
                                  #{o.orderNumber}
                                </span>
                                <OrderStatusPill status={o.status} />
                              </div>
                              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                                {o._count.items} {o._count.items === 1 ? "ítem" : "ítems"} ·{" "}
                                {o.createdAt.toLocaleString("es-BO", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                  timeZone: "America/La_Paz",
                                })}
                              </p>
                            </div>
                            <p className="text-sm font-semibold num-tabular">
                              {formatBob(Number(o.total))}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {/* Contact aside */}
            <aside>
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="text-sm font-semibold">Contacto</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--fg-soft)]">
                    <Phone className="size-4 text-[color:var(--muted)]" />
                    <span className="num-tabular">{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <p className="text-xs text-[color:var(--muted)]">{customer.email}</p>
                  )}
                </div>
                <Link
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-medium text-white"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Link>
              </div>

              {customer.lastAddressText && (
                <div className="mt-4 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                  <h3 className="text-sm font-semibold">Última dirección</h3>
                  <p className="mt-2 text-sm">{customer.lastAddressText}</p>
                  {customer.lastNote && (
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      Ref: {customer.lastNote}
                    </p>
                  )}
                </div>
              )}
            </aside>
          </div>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
      <p className="text-xs text-[color:var(--muted)]">{label}</p>
      <p className="font-display mt-1 text-2xl num-tabular">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">{hint}</p>}
    </div>
  );
}
