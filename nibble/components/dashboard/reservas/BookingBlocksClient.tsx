"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CalendarX, Plus, Trash2, X } from "lucide-react";
import {
  createBookingBlockAction,
  deleteBookingBlockAction,
  type BlockFormState,
} from "@/server/actions/booking-blocks";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";

type Block = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

const initial: BlockFormState = {};

/**
 * UI para que el owner gestione días/horas bloqueados. Dos modos en el
 * mismo form:
 *   - "Día(s) entero(s)": el owner elige fechas (sin hora) — vacaciones.
 *   - "Horas sueltas": el owner elige rango con hora exacta — almuerzo,
 *     cita personal.
 *
 * Lista muestra los bloqueos vigentes y futuros (no pasados).
 */
export function BookingBlocksClient({ blocks }: { blocks: Block[] }) {
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Block | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(b: Block) {
    setError(null);
    const fd = new FormData();
    fd.set("id", b.id);
    startTransition(async () => {
      const res = await deleteBookingBlockAction(fd);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarX className="size-4 text-[color:var(--color-tomato-600)]" />
            <h2 className="font-display text-lg">Días u horas bloqueadas</h2>
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Marca vacaciones, feriados o ratos donde no atiendes. Los
            clientes no van a poder reservar en esos horarios.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
          >
            <Plus className="size-4" />
            Bloquear horario
          </button>
        )}
      </div>

      {showForm && (
        <BlockForm onDone={() => setShowForm(false)} />
      )}

      {error && <ErrorAlert className="mt-4">{error}</ErrorAlert>}

      {blocks.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          Sin bloqueos. Tu calendario respeta los horarios de tu tienda.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{formatRange(b.startsAt, b.endsAt)}</p>
                {b.reason && (
                  <p className="text-xs text-[color:var(--muted)]">{b.reason}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(b)}
                aria-label="Eliminar bloqueo"
                className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="¿Eliminar este bloqueo?"
        message="Los clientes van a poder volver a reservar en este horario."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function BlockForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(createBookingBlockAction, initial);
  const [allDay, setAllDay] = useState(true);
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="mt-4 space-y-4 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--bg)] p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Nuevo bloqueo</p>
        <button
          type="button"
          onClick={onDone}
          aria-label="Cerrar"
          className="grid size-7 place-items-center rounded-full hover:bg-[color:var(--card)]"
        >
          <X className="size-4" />
        </button>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="size-4 rounded border-[color:var(--line-strong)]"
        />
        Bloquear día(s) entero(s)
        <span className="text-xs text-[color:var(--muted)]">
          (vacaciones, feriado)
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[color:var(--muted)]">
            Desde
          </span>
          <input
            name="startsAt"
            type={allDay ? "date" : "datetime-local"}
            required
            className={`mt-1 w-full rounded-xl border ${
              fe.startsAt
                ? "border-[color:var(--color-tomato-500)]"
                : "border-[color:var(--line-strong)]"
            } bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
          />
          {fe.startsAt && (
            <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
              {fe.startsAt}
            </p>
          )}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[color:var(--muted)]">
            Hasta
          </span>
          <input
            name="endsAt"
            type={allDay ? "date" : "datetime-local"}
            required
            className={`mt-1 w-full rounded-xl border ${
              fe.endsAt
                ? "border-[color:var(--color-tomato-500)]"
                : "border-[color:var(--line-strong)]"
            } bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
          />
          {fe.endsAt && (
            <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
              {fe.endsAt}
            </p>
          )}
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          Motivo (opcional)
        </span>
        <input
          name="reason"
          placeholder="Ej. Vacaciones, capacitación, cita médica"
          maxLength={200}
          className={`mt-1 w-full rounded-xl border ${
            fe.reason
              ? "border-[color:var(--color-tomato-500)]"
              : "border-[color:var(--line-strong)]"
          } bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
        />
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Solo lo ves tú. Sirve para acordarte por qué bloqueaste el rato.
        </p>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-4 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </button>
        <SubmitButton shape="pill" size="sm">Bloquear</SubmitButton>
      </div>
    </form>
  );
}

// ============== Helpers ==============

import {
  WEEKDAY_ES_SHORT,
  MONTH_ES_SHORT,
} from "@/lib/i18n/dates";
import { inBolivia } from "@/lib/booking/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formateadores TZ-aware: derivan los componentes de fecha/hora desde
 * el clock de Bolivia, no del browser. Esto asegura que un owner que
 * abre el dashboard desde otra TZ (laptop con VPN, viaje) vea las
 * mismas horas que el bloqueo realmente representa en Bolivia.
 */
function formatDate(d: Date): string {
  const b = inBolivia(d);
  const weekday = WEEKDAY_ES_SHORT[b.weekday]?.toLowerCase() ?? "";
  return `${weekday}, ${b.day} ${MONTH_ES_SHORT[b.month] ?? ""}`;
}
function formatTime(d: Date): string {
  const b = inBolivia(d);
  return `${String(b.hours).padStart(2, "0")}:${String(b.minutes).padStart(2, "0")}`;
}

/**
 * Detecta si un rango es "día(s) entero(s)" en hora Bolivia. Convención
 * half-open: arranca a las 00:00 BOT del primer día y termina a las
 * 00:00 BOT del día siguiente al último (end exclusive).
 */
function isAllDay(s: Date, e: Date): boolean {
  const bs = inBolivia(s);
  const be = inBolivia(e);
  return (
    bs.hours === 0 && bs.minutes === 0 &&
    be.hours === 0 && be.minutes === 0
  );
}

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const allDay = isAllDay(s, e);

  if (allDay) {
    // Con half-open, el último día "incluido" es `e - 1 día`. Si el
    // rango es de un solo día, end == start + 24h y mostramos sólo
    // esa fecha. Sin este ajuste, "lun 12 → mar 13 — todo el día"
    // confundía: para el owner significa "bloqueado lunes y martes",
    // pero en realidad es sólo el lunes.
    const lastDayInclusive = new Date(e.getTime() - DAY_MS);
    const isSingleDay = e.getTime() - s.getTime() === DAY_MS;
    if (isSingleDay) return `${formatDate(s)} — todo el día`;
    return `${formatDate(s)} → ${formatDate(lastDayInclusive)} — todo el día`;
  }

  const sameDay = formatDate(s) === formatDate(e);
  if (sameDay) {
    return `${formatDate(s)} · ${formatTime(s)} – ${formatTime(e)}`;
  }
  return `${formatDate(s)} ${formatTime(s)} → ${formatDate(e)} ${formatTime(e)}`;
}
