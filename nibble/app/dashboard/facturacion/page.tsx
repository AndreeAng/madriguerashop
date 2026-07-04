import { CheckCircle2, Clock, FileText, ShieldX } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwnerOnly } from "@/lib/auth/session";
import { getSaasSettings } from "@/lib/saas/settings";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { formatBob } from "@/lib/utils";
import { InvoiceProofForm } from "@/components/dashboard/facturacion/InvoiceProofForm";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = {
  title: "Facturación · Madriguera Shop",
};

const STATUS_CHIPS = {
  PENDING: { label: "Pendiente", bg: "bg-amber-100", fg: "text-amber-700", icon: Clock },
  OVERDUE: {
    label: "Vencida",
    bg: "bg-red-100",
    fg: "text-red-700",
    icon: ShieldX,
  },
  PAID: { label: "Pagada", bg: "bg-emerald-100", fg: "text-emerald-700", icon: CheckCircle2 },
  DRAFT: { label: "Borrador", bg: "bg-gray-100", fg: "text-gray-700", icon: FileText },
  CANCELLED: { label: "Cancelada", bg: "bg-gray-100", fg: "text-gray-500", icon: ShieldX },
} as const;

export default async function FacturacionPage() {
  const { store } = await requireOwnerOnly();

  const invoices = await db.invoice.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const open = invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");
  const past = invoices.filter((i) => i.status === "PAID" || i.status === "CANCELLED");

  const saas = await getSaasSettings();
  const saasQrUrl = saas.paymentQrUrl ?? null;
  const saasInstructions = saas.paymentInstructions;

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Tu cuenta con Madriguera Shop
            </p>
            <h1 className="font-display mt-1 text-3xl">Facturación</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {open.length > 0
                ? `${open.length} factura${open.length === 1 ? "" : "s"} pendiente${open.length === 1 ? "" : "s"} de pago.`
                : "Sin facturas pendientes."}
            </p>
          </div>

          {/* Estado de la tienda */}
          {(store.status === "PAST_DUE" || store.status === "SUSPENDED") && (
            <div
              className={`mt-6 rounded-2xl border p-4 ${
                store.status === "SUSPENDED"
                  ? "border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5"
                  : "border-[color:var(--color-amber-500)]/30 bg-[color:var(--color-amber-50)]"
              }`}
            >
              <p className="text-sm font-semibold">
                {store.status === "SUSPENDED"
                  ? "Tu tienda está suspendida"
                  : "Pago atrasado"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--fg-soft)]">
                {store.status === "SUSPENDED"
                  ? "El storefront no es accesible para el público hasta que regularices el pago."
                  : "Tu storefront sigue funcionando, pero te recomendamos regularizar para evitar suspensión."}
              </p>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Facturas */}
            <div className="space-y-6">
              {open.length > 0 && (
                <section>
                  <h2 className="font-display text-xl">Pendientes</h2>
                  <ul className="mt-3 space-y-3">
                    {open.map((inv) => (
                      <InvoiceCard
                        key={inv.id}
                        invoice={inv}
                        editable
                      />
                    ))}
                  </ul>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  <h2 className="font-display text-xl">Historial</h2>
                  <ul className="mt-3 space-y-2">
                    {past.map((inv) => (
                      <InvoiceCard key={inv.id} invoice={inv} editable={false} />
                    ))}
                  </ul>
                </section>
              )}

              {invoices.length === 0 && (
                <EmptyState
                  icon={<FileText className="size-8" />}
                  description="Todavía no se generó ninguna factura."
                  className="border-solid"
                />
              )}
            </div>

            {/* Cómo pagar */}
            <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
                <h3 className="font-semibold">Cómo pagar</h3>
                {saasQrUrl ? (
                  <div className="mt-4 aspect-square overflow-hidden rounded-xl border border-[color:var(--line-strong)] bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={saasQrUrl}
                      alt="QR de pago"
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex aspect-square items-center justify-center rounded-xl border border-dashed border-[color:var(--line-strong)] bg-[color:var(--bg)] text-center">
                    <p className="px-6 text-xs text-[color:var(--muted)]">
                      QR no configurado todavía. Contáctanos por WhatsApp.
                    </p>
                  </div>
                )}
                <p className="mt-3 text-xs text-[color:var(--muted)]">{saasInstructions}</p>
              </div>
            </aside>
        </div>
      </main>
    </>
  );
}

function InvoiceCard({
  invoice,
  editable,
}: {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: { toString: () => string };
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    status: keyof typeof STATUS_CHIPS;
    dueDate: Date;
    paidAt: Date | null;
    paidProofUrl: string | null;
    notes: string | null;
  };
  editable: boolean;
}) {
  const chip = STATUS_CHIPS[invoice.status];
  const Icon = chip.icon;

  return (
    <li className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{invoice.invoiceNumber}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.bg} ${chip.fg}`}
            >
              <Icon className="size-3" />
              {chip.label}
            </span>
          </div>
          <p className="mt-2 font-display text-2xl num-tabular">
            {formatBob(Number(invoice.amount))}
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Período:{" "}
            {invoice.periodStart.toLocaleDateString("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" })} —{" "}
            {invoice.periodEnd.toLocaleDateString("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" })}
          </p>
          <p className="text-xs text-[color:var(--muted)]">
            Vence:{" "}
            {invoice.dueDate.toLocaleDateString("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" })}
          </p>
          {invoice.paidAt && (
            <p className="text-xs text-[color:var(--color-leaf-600)]">
              Pagada: {invoice.paidAt.toLocaleDateString("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" })}
            </p>
          )}
          {invoice.notes && (
            <p className="mt-2 rounded-lg bg-[color:var(--bg)] p-2 text-xs italic text-[color:var(--muted)]">
              {invoice.notes}
            </p>
          )}
        </div>
      </div>

      {editable && (
        <div className="mt-5 border-t border-[color:var(--line)] pt-4">
          <InvoiceProofForm
            invoiceId={invoice.id}
            initialProofUrl={invoice.paidProofUrl}
          />
        </div>
      )}

      {!editable && invoice.paidProofUrl && (
        <a
          href={invoice.paidProofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-[color:var(--muted)] hover:text-[color:var(--fg)] hover:underline"
        >
          Ver comprobante →
        </a>
      )}
    </li>
  );
}
