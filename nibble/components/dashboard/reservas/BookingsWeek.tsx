"use client";

import { useTransition, useState } from "react";
import { Phone, MessageSquare, Check, X, CheckCircle2, UserX } from "lucide-react";
import {
  cancelBookingAction,
  confirmBookingAction,
  markBookingCompletedAction,
  markBookingNoShowAction,
} from "@/server/actions/bookings";
import { sameDay, ymdLocal } from "@/lib/i18n/dates";

type Booking = {
  id: string;
  productName: string;
  durationMin: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
};

const WEEKDAY_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Vista semanal de reservas. Una columna por día (Lun→Dom) con las
 * reservas del día apiladas verticalmente. Para una agenda chica
 * (servicios solos), esto se ve mejor que un grid h × v real estilo
 * Google Calendar — menos espacio vacío, más densidad de info útil.
 *
 * Si en el futuro hay multi-staff y necesitamos "swimlanes" por
 * empleado, el componente se rediseña con grilla real.
 */
export function BookingsWeek({
  weekStart,
  bookings,
}: {
  weekStart: string;
  bookings: Booking[];
}) {
  const start = new Date(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  // `today` lazy-init: `new Date()` en el body del render dispara
  // hydration mismatch si SSR y client cruzan medianoche. Con useState
  // queda fijo al primer mount.
  const [today] = useState<Date>(() => new Date());

  // Indexar por día calendario LOCAL del cliente. Antes usábamos
  // `b.startsAt.slice(0, 10)` que extrae el YMD del ISO UTC — eso
  // colocaba una reserva de las 23:00 BOT (= 03:00 UTC del día siguiente)
  // en la columna equivocada para owners en Bolivia.
  const byDay = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = ymdLocal(new Date(b.startsAt));
    const arr = byDay.get(key) ?? [];
    arr.push(b);
    byDay.set(key, arr);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((d, idx) => {
        const ymd = ymdLocal(d);
        const dayBookings = byDay.get(ymd) ?? [];
        const isToday = sameDay(d, today);
        return (
          <div
            key={ymd}
            className={`rounded-2xl border ${
              isToday
                ? "border-[color:var(--color-amber-400)] bg-[color:var(--color-amber-50)]"
                : "border-[color:var(--line)] bg-[color:var(--card)]"
            } p-3`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--muted)]">
              {WEEKDAY_ES[idx]}
            </p>
            <p className="num-tabular text-lg font-semibold leading-tight">
              {d.getDate()}
            </p>
            {dayBookings.length === 0 ? (
              <p className="mt-4 text-[11px] text-[color:var(--muted)]">
                Sin reservas
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dayBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

const STATUS_STYLES: Record<Booking["status"], string> = {
  PENDING: "border-amber-300 bg-amber-50",
  CONFIRMED: "border-emerald-300 bg-emerald-50",
  CANCELLED: "border-rose-200 bg-rose-50 opacity-60",
  COMPLETED: "border-[color:var(--line)] bg-[color:var(--bg)] opacity-70",
  NO_SHOW: "border-rose-200 bg-rose-50 opacity-60",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  NO_SHOW: "No vino",
};

function BookingCard({ booking }: { booking: Booking }) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `cancelMode` controla la sub-UI cuando el owner aprieta "Cancelar":
  // muestra un textarea para el motivo en vez del prompt nativo del
  // browser. El prompt rompe el theming, no se puede estilar y en
  // mobile es horrible — el inline form es controlable y consistente.
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  function runAction(
    action: typeof confirmBookingAction,
    extra?: Record<string, string>,
  ) {
    setError(null);
    const fd = new FormData();
    fd.set("bookingId", booking.id);
    if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    startTransition(async () => {
      const res = await action(fd);
      if (res.error) setError(res.error);
      else {
        setCancelMode(false);
        setCancelReason("");
      }
    });
  }

  const startTime = new Date(booking.startsAt);
  const endTime = new Date(booking.endsAt);
  const hh = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <li
      className={`rounded-xl border p-2.5 text-xs ${STATUS_STYLES[booking.status]}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="block w-full text-left"
      >
        <p className="num-tabular text-[11px] font-semibold text-[color:var(--fg)]">
          {hh(startTime)} – {hh(endTime)}
        </p>
        <p className="mt-0.5 truncate font-medium">{booking.productName}</p>
        <p className="truncate text-[10px] text-[color:var(--muted)]">
          {booking.customerName}
        </p>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-[color:var(--line)] pt-2">
          <p className="text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
            {STATUS_LABEL[booking.status]}
          </p>
          <p className="flex items-center gap-1 text-[11px]">
            <Phone className="size-3" />
            <span className="num-tabular">{booking.customerPhone}</span>
          </p>
          {booking.notes && (
            <p className="flex items-start gap-1 text-[11px] text-[color:var(--fg-soft)]">
              <MessageSquare className="mt-0.5 size-3 shrink-0" />
              <span className="break-words">{booking.notes}</span>
            </p>
          )}

          {error && (
            <p role="alert" className="text-[11px] text-rose-700">
              {error}
            </p>
          )}

          {cancelMode ? (
            <div className="space-y-1.5">
              <label className="block">
                <span className="text-[10px] font-medium text-[color:var(--muted)]">
                  Motivo (opcional)
                </span>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="Ej. cliente avisó, fuerza mayor…"
                  className="mt-1 w-full resize-none rounded-lg border border-[color:var(--line-strong)] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[color:var(--color-amber-400)]"
                />
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    runAction(cancelBookingAction, { cancelReason })
                  }
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirmar cancelación
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelMode(false);
                    setCancelReason("");
                  }}
                  disabled={pending}
                  className="rounded-full px-2.5 py-1 text-[10px] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {booking.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => runAction(confirmBookingAction)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="size-3" />
                  Confirmar
                </button>
              )}
              {booking.status === "CONFIRMED" && (
                <>
                  <button
                    type="button"
                    onClick={() => runAction(markBookingCompletedAction)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-bark-900)] px-2.5 py-1 text-[10px] font-medium text-white hover:bg-[color:var(--color-bark-700)] disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-3" />
                    Marcar atendida
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(markBookingNoShowAction)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-300 px-2.5 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <UserX className="size-3" />
                    No vino
                  </button>
                </>
              )}
              {(booking.status === "PENDING" ||
                booking.status === "CONFIRMED") && (
                <button
                  type="button"
                  onClick={() => setCancelMode(true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-300 px-2.5 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  <X className="size-3" />
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// `sameDay` y `ymdLocal` se importan desde `lib/i18n/dates`.
