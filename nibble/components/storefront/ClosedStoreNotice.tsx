"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Moon, X, CalendarClock } from "lucide-react";
import type { StoreView } from "@/lib/storefront/types";

/**
 * Popup auto-mostrado cuando la tienda está cerrada (`store.isOpenNow=false`).
 *
 * Diferencias con `StorefrontPopup`:
 *   - Es automático y NO configurable por el owner — depende sólo del estado
 *     real del horario en este momento.
 *   - No persiste como "show once": dismissed se guarda en sessionStorage,
 *     entonces al volver a la tab vuelve a aparecer (intencional: el cliente
 *     debe saber que el local está cerrado al volver, no que ya lo cerró
 *     ayer y "ya vio el aviso").
 *   - Trae CTA "Programar pedido" que envía al checkout en modo scheduled.
 *
 * El componente se monta en el home y aparece tras 800ms para no chocar
 * con el primer paint y dejar al cliente ver el hero primero.
 */

const SESSION_KEY = "nibble:closed-notice-dismissed";

const DAY_NAMES_SHORT_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun..Sáb..Dom
const DAY_NAMES_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ClosedStoreNotice({
  store,
  hours,
}: {
  store: Pick<StoreView, "name" | "isOpenNow" | "nextOpeningLabel" | "whatsapp" | "slug">;
  /** Array de StoreHours por día de semana (0=domingo … 6=sábado).
   *  El caller filtra/normaliza antes de pasar. */
  hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (store.isOpenNow) return;
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(SESSION_KEY);
    if (dismissed === "1") return;
    // 800ms de delay para que el hero respire antes del popup
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [store.isOpenNow]);

  if (!visible || store.isOpenNow) return null;

  const close = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  // Ordenamos los días lunes a domingo (cultura BO). Domingo va último.
  const today = new Date().getDay();
  const orderedHours = DAY_NAMES_SHORT_ORDER.map((dow) =>
    hours.find((h) => h.dayOfWeek === dow),
  ).filter((h): h is NonNullable<typeof h> => h !== undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="closed-notice-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[color:var(--card)] shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar aviso"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
        >
          <X className="size-4" />
        </button>

        <div
          className="px-6 pb-2 pt-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--color-amber-100) 60%, var(--card)), var(--card))",
          }}
        >
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[color:var(--color-amber-500)]/15 text-[color:var(--color-amber-700)]">
            <Moon className="size-5" />
          </div>
          <h2
            id="closed-notice-title"
            className="font-display mt-3 text-2xl text-[color:var(--fg)]"
          >
            {store.name} está cerrado
          </h2>
          {store.nextOpeningLabel && (
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {store.nextOpeningLabel}
            </p>
          )}
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              <Clock className="size-3" />
              Horarios de atención
            </p>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              {orderedHours.map((h) => {
                const isToday = h.dayOfWeek === today;
                return (
                  <li
                    key={h.dayOfWeek}
                    className={`flex items-center justify-between gap-3 ${
                      isToday ? "font-semibold text-[color:var(--fg)]" : ""
                    }`}
                  >
                    <span
                      className={
                        isToday ? "" : "text-[color:var(--muted)]"
                      }
                    >
                      {DAY_NAMES_ES[h.dayOfWeek]}
                      {isToday && (
                        <span className="ml-1.5 rounded-full bg-[color:var(--color-amber-500)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-amber-700)]">
                          hoy
                        </span>
                      )}
                    </span>
                    <span className="num-tabular tabular-nums text-[color:var(--fg-soft)]">
                      {h.isClosed
                        ? "Cerrado"
                        : `${h.openTime} – ${h.closeTime}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={`/${store.slug}/checkout`}
              onClick={close}
              className="press inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--color-bark-900)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--color-bark-700)]"
            >
              <CalendarClock className="size-4" />
              Programar pedido
            </Link>
            <button
              type="button"
              onClick={close}
              className="rounded-xl px-5 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            >
              Ver el catálogo igual
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-[color:var(--muted)]">
            Igual puedes revisar productos y agregarlos al carrito. Te
            atendemos en horario.
          </p>
        </div>
      </div>
    </div>
  );
}
