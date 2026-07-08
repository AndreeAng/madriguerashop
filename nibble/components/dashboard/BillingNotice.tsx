"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import type { DunningNotice, DunningLevel } from "@/lib/billing/dunning-notice";

/**
 * Aviso de cobranza en el dashboard del dueño. Banner persistente en todas las
 * páginas + modal la primera vez por sesión para los estados urgentes.
 *
 *   - suspended / overdue → banner ROJO no-cerrable + modal 1×/sesión.
 *   - due_today / due_soon → banner ÁMBAR cerrable (por sesión).
 *
 * El tracking (banner cerrado / modal visto) vive en `sessionStorage`, sin DB:
 * si sigue suspendida, el modal reaparece en la próxima sesión del navegador.
 * Ver `docs/superpowers/specs/2026-07-08-dashboard-dunning-notice-design.md`.
 */

type Copy = { title: string; body: string; urgent: boolean };

function copyFor(notice: NonNullable<DunningNotice>): Copy {
  const level: DunningLevel = notice.level;
  switch (level) {
    case "suspended":
      return {
        title: "Tu tienda está suspendida",
        body: "No está visible para tus clientes hasta que regularices el pago.",
        urgent: true,
      };
    case "overdue":
      return {
        title: "Tenés una factura vencida",
        body: "Regularizá el pago antes de que se suspenda tu tienda.",
        urgent: true,
      };
    case "due_today":
      return {
        title: "Tu factura vence hoy",
        body: "Pagá hoy para mantener tu tienda activa.",
        urgent: false,
      };
    case "due_soon": {
      const n = notice.daysUntilDue ?? 0;
      return {
        title: `Tu factura vence en ${n} ${n === 1 ? "día" : "días"}`,
        body: "Pagá con tiempo para evitar inconvenientes.",
        urgent: false,
      };
    }
  }
}

export function BillingNotice({ notice }: { notice: DunningNotice }) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!notice) return;
    setMounted(true);
    const urgent = notice.level === "suspended" || notice.level === "overdue";
    if (urgent) {
      if (sessionStorage.getItem(`dunning-modal-seen:${notice.level}`) !== "1") {
        setModalOpen(true);
      }
    } else {
      setDismissed(
        sessionStorage.getItem(`dunning-banner-dismissed:${notice.level}`) === "1",
      );
    }
  }, [notice]);

  if (!notice) return null;
  const copy = copyFor(notice);
  const urgent = copy.urgent;

  const closeModal = () => {
    sessionStorage.setItem(`dunning-modal-seen:${notice.level}`, "1");
    setModalOpen(false);
  };
  const dismissBanner = () => {
    sessionStorage.setItem(`dunning-banner-dismissed:${notice.level}`, "1");
    setDismissed(true);
  };

  // Banner cerrable (no urgente): solo tras montar y si no fue cerrado — evita
  // flash de un banner ya descartado durante la hidratación.
  const showBanner = urgent || (mounted && !dismissed);

  const tone = urgent
    ? {
        wrap: "border-[color:var(--color-tomato-500)]/40 bg-[color:var(--color-tomato-500)]/5",
        icon: "text-[color:var(--color-tomato-600)]",
        title: "text-[color:var(--color-tomato-700)]",
        cta: "bg-[color:var(--color-tomato-600)] text-white hover:bg-[color:var(--color-tomato-700)]",
      }
    : {
        wrap: "border-[color:var(--color-amber-500)]/40 bg-[color:var(--color-amber-50)]",
        icon: "text-[color:var(--color-amber-600)]",
        title: "text-[color:var(--color-amber-700)]",
        cta: "bg-[color:var(--color-bark-900)] text-white hover:bg-[color:var(--color-bark-700)]",
      };

  return (
    <>
      {showBanner && (
        <div
          role="alert"
          className={`mx-4 mt-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 ${tone.wrap}`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`mt-0.5 size-5 shrink-0 ${tone.icon}`} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${tone.title}`}>{copy.title}</p>
              <p className="mt-0.5 text-xs text-[color:var(--fg-soft)]">{copy.body}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/facturacion"
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium ${tone.cta}`}
            >
              <CreditCard className="size-3.5" />
              Ver facturación
            </Link>
            {!urgent && (
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Cerrar aviso"
                className="rounded-full p-1.5 text-[color:var(--fg-soft)] hover:bg-black/5"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="billing-notice-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[color:var(--card)] p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`mt-0.5 size-6 shrink-0 ${tone.icon}`} />
              <div className="min-w-0">
                <h2
                  id="billing-notice-title"
                  className="text-lg font-semibold text-[color:var(--fg)]"
                >
                  {copy.title}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--fg-soft)]">{copy.body}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Link
                href="/dashboard/facturacion"
                onClick={closeModal}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${tone.cta}`}
              >
                <CreditCard className="size-4" />
                Ir a facturación
              </Link>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full px-4 py-2 text-sm font-medium text-[color:var(--fg-soft)] hover:bg-black/5"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
