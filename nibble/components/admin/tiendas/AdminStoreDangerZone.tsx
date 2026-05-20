"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pause, Play, Trash2 } from "lucide-react";
import { StoreStatus } from "@prisma/client";
import {
  adminToggleStoreStatusAction,
  adminDeleteStoreAction,
  type AdminToggleStoreStatusState,
  type AdminDeleteStoreState,
} from "@/server/actions/admin-stores";
import { SubmitButton } from "@/components/ui/SubmitButton";

type DangerZoneProps = {
  storeId: string;
  slug: string;
  status: StoreStatus;
  counts: {
    orders: number;
    products: number;
    customers: number;
    invoices: number;
  };
};

const toggleInitial: AdminToggleStoreStatusState = {};
const deleteInitial: AdminDeleteStoreState = {};

/**
 * Zona de peligro del detalle de tienda. Dos acciones críticas:
 *
 *  1. SUSPENDER / REACTIVAR — toggle reversible. Suspender corta el
 *     storefront público + bloquea login del owner pero deja la data
 *     intacta. Reactivar revierte. Para clientes que no pagan, demos
 *     pausadas, o tiendas en disputa.
 *
 *  2. ELIMINAR PERMANENTEMENTE — destructivo, irreversible. Borra la
 *     tienda + TODOS sus pedidos, productos, facturas, clientes, blobs.
 *     Confirmación: el admin tiene que TIPEAR el slug exacto, no alcanza
 *     un click. Patrón GitHub/Linear — fricción intencional contra
 *     accidentes (mistapsing > misclicking).
 */
export function AdminStoreDangerZone({ storeId, slug, status, counts }: DangerZoneProps) {
  const isSuspended = status === StoreStatus.SUSPENDED;
  const isCancelled = status === StoreStatus.CANCELLED;

  return (
    <section className="mt-8 rounded-3xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-[color:var(--color-tomato-600)]" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-tomato-600)]">
          Zona de peligro
        </h2>
      </div>

      {/* Suspender / Reactivar */}
      <div className="mt-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
        <SuspendBlock storeId={storeId} status={status} isSuspended={isSuspended} isCancelled={isCancelled} />
      </div>

      {/* Eliminar permanente */}
      <div className="mt-3 rounded-2xl border border-[color:var(--color-tomato-500)]/40 bg-[color:var(--card)] p-4">
        <DeleteBlock storeId={storeId} slug={slug} counts={counts} />
      </div>
    </section>
  );
}

// ============== Suspender / Reactivar ==============

function SuspendBlock({
  storeId,
  status,
  isSuspended,
  isCancelled,
}: {
  storeId: string;
  status: StoreStatus;
  isSuspended: boolean;
  isCancelled: boolean;
}) {
  const [state, action] = useActionState(adminToggleStoreStatusAction, toggleInitial);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (isCancelled) {
    return (
      <p className="text-sm text-[color:var(--fg-soft)]">
        Esta tienda está cancelada. Solo se puede eliminar permanentemente.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="action" value={isSuspended ? "reactivate" : "suspend"} />

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isSuspended ? "Reactivar tienda" : "Suspender tienda"}
          </p>
          <p className="mt-1 text-xs text-[color:var(--fg-soft)]">
            {isSuspended
              ? "Vuelve a estado ACTIVE: el storefront público se hace visible de nuevo y el owner puede entrar al dashboard. Si la suspensión original fue por mora, el cron de billing puede volver a suspenderla si la factura sigue vencida."
              : "Marca la tienda como SUSPENDED: el storefront público devuelve 404, el owner no puede crear pedidos, las subidas de comprobante se bloquean. Reversible en cualquier momento desde acá mismo."}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted)]">
            Estado actual: <span className="font-mono">{status}</span>
          </p>
        </div>
      </div>

      {!isSuspended && (
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted)]">
            Razón <span className="font-normal normal-case text-[color:var(--fg-soft)]">(queda en audit log)</span>
          </span>
          <textarea
            name="reason"
            rows={2}
            placeholder="Ej: factura vencida 30 días sin pago. Cliente avisado por WhatsApp el 12/05."
            className="mt-1 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
          {state.fieldErrors?.reason && (
            <p role="alert" className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
              {state.fieldErrors.reason}
            </p>
          )}
        </label>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton
          shape="pill"
          pendingLabel={isSuspended ? "Reactivando…" : "Suspendiendo…"}
          // Reactivar usa color neutral (no es destructivo); suspender ámbar.
          className={
            isSuspended
              ? "inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
              : "inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-amber-500)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-amber-600)]"
          }
        >
          {isSuspended ? (
            <>
              <Play className="size-3.5" />
              Reactivar tienda
            </>
          ) : (
            <>
              <Pause className="size-3.5" />
              Suspender tienda
            </>
          )}
        </SubmitButton>
      </div>
    </form>
  );
}

// ============== Eliminar permanente ==============

function DeleteBlock({
  storeId,
  slug,
  counts,
}: {
  storeId: string;
  slug: string;
  counts: DangerZoneProps["counts"];
}) {
  const [state, action] = useActionState(adminDeleteStoreAction, deleteInitial);
  // Estado controlado del input de confirmación. El submit se habilita solo
  // cuando lo escrito matchea exacto — no alcanza el server-side check
  // porque queremos feedback visual inmediato del input "OK/no OK".
  const [typed, setTyped] = useState("");
  const slugMatches = typed === slug;

  // Contenido contextual: si la tienda tiene órdenes o facturas, lo
  // remarcamos. Borrar tiendas con historial financiero es un movimiento
  // serio (auditoría SIAT, posibles disputas) y queremos que el admin sea
  // consciente antes de confirmar.
  const hasFinancialHistory = counts.orders > 0 || counts.invoices > 0;

  return (
    <details className="group">
      <summary className="cursor-pointer select-none">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-tomato-700)]">
          <Trash2 className="size-4" />
          Eliminar permanentemente
        </span>
        <span className="ml-2 text-xs text-[color:var(--fg-soft)] group-open:hidden">
          (irreversible)
        </span>
      </summary>

      <div className="mt-4 space-y-3">
        <p className="text-xs text-[color:var(--fg-soft)]">
          Esta acción borra la tienda y todos sus datos relacionados.{" "}
          <strong className="text-[color:var(--color-tomato-700)]">
            No se puede deshacer.
          </strong>{" "}
          Para suspender temporalmente sin borrar, usá el botón de suspender arriba.
        </p>

        <div className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--color-tomato-700)]">
            Se eliminarán:
          </p>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <li>
              <span className="num-tabular font-semibold">{counts.products}</span> producto{counts.products === 1 ? "" : "s"} (con imágenes)
            </li>
            <li>
              <span className="num-tabular font-semibold">{counts.orders}</span> pedido{counts.orders === 1 ? "" : "s"} (con items, pagos)
            </li>
            <li>
              <span className="num-tabular font-semibold">{counts.customers}</span> cliente{counts.customers === 1 ? "" : "s"}
            </li>
            <li>
              <span className="num-tabular font-semibold">{counts.invoices}</span> factura{counts.invoices === 1 ? "" : "s"} de billing
            </li>
            <li className="sm:col-span-2">
              Categorías, cupones, banners, popups, zonas de delivery, horarios, page views.
            </li>
            <li className="sm:col-span-2">
              Imágenes en almacenamiento (logo, banner, favicon, productos, QR, comprobantes).
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-[color:var(--fg-soft)]">
            El owner queda deshabilitado (cuenta no borrada, audit logs preservados).
          </p>
        </div>

        {hasFinancialHistory && (
          <div className="rounded-lg border border-[color:var(--color-amber-500)]/30 bg-[color:var(--color-amber-50)] p-3 text-xs text-[color:var(--color-amber-800)]">
            <strong>Esta tienda tiene historial financiero.</strong> Borrar
            órdenes y facturas elimina evidencia que podría ser requerida
            ante una auditoría (SIAT, disputas de pago). Considera
            archivar/suspender en su lugar si no tienes certeza.
          </div>
        )}

        <form action={action} className="space-y-3">
          <input type="hidden" name="storeId" value={storeId} />
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted)]">
              Para confirmar, escribe{" "}
              <code className="rounded bg-[color:var(--bg)] px-1 py-0.5 font-mono text-[color:var(--fg)]">
                {slug}
              </code>
            </span>
            <input
              name="confirmSlug"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={slug}
              className={`mt-1 w-full rounded-lg border bg-[color:var(--card)] px-3 py-2 font-mono text-sm outline-none ${
                typed.length === 0
                  ? "border-[color:var(--line-strong)]"
                  : slugMatches
                    ? "border-[color:var(--color-tomato-500)]"
                    : "border-[color:var(--color-amber-400)]"
              }`}
            />
            {state.fieldErrors?.confirmSlug && (
              <p role="alert" className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
                {state.fieldErrors.confirmSlug}
              </p>
            )}
          </label>

          {state.error && (
            <p
              role="alert"
              className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
            >
              {state.error}
            </p>
          )}

          <div className="flex justify-end">
            <SubmitButton
              shape="pill"
              pendingLabel="Eliminando…"
              disabled={!slugMatches}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-tomato-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-tomato-700)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Eliminar tienda definitivamente
            </SubmitButton>
          </div>
        </form>
      </div>
    </details>
  );
}
