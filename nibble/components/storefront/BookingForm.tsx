"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  createBookingAction,
  type CreateBookingState,
} from "@/server/actions/bookings";
import { fetchAvailableSlotsAction } from "@/server/actions/booking-slots";
import { PhoneInputBO } from "@/components/shared/PhoneInputBO";
import { SubmitButton } from "@/components/ui/SubmitButton";

import { WEEKDAY_ES_SHORT, ymdLocal, startOfDay } from "@/lib/i18n/dates";

type Slot = { startsAt: string; label: string };

const initial: CreateBookingState = {};

/**
 * Formulario de reserva para productos `isBookable`. Reemplaza al
 * "Agregar al carrito" tradicional cuando el producto es un servicio.
 *
 * UX en 3 pasos en la misma pantalla:
 *   1. Selector de día (próximos 14 días en chips).
 *   2. Selector de hora (slots libres del día elegido).
 *   3. Form mínimo: nombre + teléfono + notas opcionales.
 *
 * Slots se cargan client-side via server action a medida que el cliente
 * cambia el día (`useEffect`). Sin esto, traeríamos los 14 días por
 * adelantado y el RSC tardaría mucho — un solo día es <50ms.
 */
export function BookingForm({
  productId,
  productName,
  storeSlug,
  durationMin,
}: {
  productId: string;
  productName: string;
  storeSlug: string;
  durationMin: number;
}) {
  const router = useRouter();
  const [state, action] = useActionState(createBookingAction, initial);
  const fe = state.fieldErrors ?? {};

  // Lazy init: `useState(() => …)` ejecuta el factory UNA SOLA VEZ; sin
  // el wrap como función, `startOfDay()` se llama en cada render aunque
  // el valor se descarte. No es bug funcional pero es overhead innecesario.
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay());
  // `slots` arranca null. La UI distingue entre null (loading inicial) y
  // [] (cargado pero vacío) para no parecer roto antes de que arranque el
  // primer effect.
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [loadingSlots, startLoadingSlots] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0);

  // Cargar slots cuando cambia el día.
  useEffect(() => {
    setSelectedSlot("");
    setSlotsError(null);
    const ymd = ymdLocal(selectedDate);
    startLoadingSlots(async () => {
      try {
        const result = await fetchAvailableSlotsAction(productId, ymd);
        setSlots(result);
      } catch (err) {
        // Server action falló (red, server error, etc.). Sin este catch
        // el `slots` queda en null y el cliente ve "Elegí la hora" sin
        // nada debajo — UX confusa.
        console.error("[BookingForm] slot fetch failed", err);
        setSlots([]);
        setSlotsError(
          "No pudimos cargar los horarios. Probá recargar la página.",
        );
      }
    });
  }, [selectedDate, productId]);

  // Redirigir al tracking de la reserva al confirmar.
  useEffect(() => {
    if (state.ok) {
      // Abrimos WhatsApp en nueva pestaña y redirigimos.
      try {
        window.open(state.ok.whatsappUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
      router.push(`/${storeSlug}/reserva/${state.ok.trackingToken}`);
    }
  }, [state.ok, router, storeSlug]);

  // `today` se calcula una sola vez al montar el componente. Antes vivía
  // en el body del render llamando `new Date()` cada vez — si el SSR
  // corría a las 23:59:58 y el cliente hidrataba a las 00:00:01, los
  // dos calculaban días distintos y React lanzaba hydration mismatch.
  const [today] = useState<Date>(() => startOfDay());
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="storeSlug" value={storeSlug} />
      <input type="hidden" name="startsAt" value={selectedSlot} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      {/* ============== Paso 1: Día ============== */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
            <CalendarClock className="mr-1 inline size-3.5" />
            Elegí el día
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              aria-label="Semana anterior"
              className="grid size-7 place-items-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--bg)] disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => Math.min(8, w + 1))}
              aria-label="Semana siguiente"
              className="grid size-7 place-items-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--bg)]"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const isPast = d < today;
            const isSelected = ymdLocal(d) === ymdLocal(selectedDate);
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={isPast}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center rounded-xl border p-2 transition ${
                  isPast
                    ? "cursor-not-allowed border-[color:var(--line)] opacity-30"
                    : isSelected
                      ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                      : "border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
                }`}
              >
                <span className="text-[10px] uppercase opacity-70">
                  {WEEKDAY_ES_SHORT[d.getDay()]}
                </span>
                <span className="num-tabular text-sm font-semibold">
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============== Paso 2: Hora ============== */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          <Clock className="mr-1 inline size-3.5" />
          Elegí la hora · {durationMin} min
        </p>
        {slotsError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-[color:var(--color-tomato-50)] px-3 py-2 text-sm text-[color:var(--color-tomato-700)]"
          >
            {slotsError}
          </p>
        ) : slots === null || loadingSlots ? (
          // `slots === null` = aún no terminó el primer effect (montaje
          // del componente). Mostrar el mismo "Buscando…" que cuando
          // cambian de día — evita el flash de "no aparece nada".
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Buscando horarios libres…
          </p>
        ) : slots.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[color:var(--bg)] px-3 py-2 text-sm text-[color:var(--muted)]">
            No hay horarios libres ese día. Probá otro.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
            {slots.map((s) => {
              const isSelected = s.startsAt === selectedSlot;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  onClick={() => setSelectedSlot(s.startsAt)}
                  className={`rounded-xl border px-2 py-2 text-sm transition ${
                    isSelected
                      ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                      : "border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
                  }`}
                >
                  <span className="num-tabular">{s.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {fe.startsAt && (
          <p className="mt-2 text-xs text-[color:var(--color-tomato-600)]">
            {fe.startsAt}
          </p>
        )}
      </div>

      {/* ============== Paso 3: Tus datos ============== */}
      <div className="space-y-3 border-t border-[color:var(--line)] pt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Tus datos
        </p>
        <Field
          label="Nombre completo"
          name="customerName"
          placeholder="Ej. María Sánchez"
          error={fe.customerName}
        />
        <PhoneInputBO
          label="WhatsApp"
          name="customerPhone"
          error={fe.customerPhone}
          required
        />
        <Field
          label="Email (opcional)"
          name="customerEmail"
          placeholder="tu@email.com"
          error={fe.customerEmail}
          inputMode="email"
        />
        <label className="block">
          <span className="text-xs font-medium text-[color:var(--muted)]">
            Notas (opcional)
          </span>
          <textarea
            name="notes"
            rows={2}
            placeholder="Alergia a tinte, primera vez, etc."
            className="mt-1 w-full resize-none rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
        </label>
      </div>

      <SubmitButton
        shape="pill"
        width="full"
        className="py-3"
        disabled={selectedSlot === ""}
        pendingLabel="Reservando…"
      >
        {selectedSlot === "" ? "Elegí un día y un horario" : `Reservar ${productName}`}
      </SubmitButton>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  error,
  inputMode,
}: {
  label: string;
  name: string;
  placeholder?: string;
  error?: string;
  inputMode?: "text" | "tel" | "email";
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`mt-1 w-full rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
      />
      {error && (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
