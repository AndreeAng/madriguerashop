"use client";

import { useActionState } from "react";
import type { StoreHours } from "@prisma/client";
import {
  updateHoursAction,
  type ActionState,
} from "@/server/actions/store-settings";
import { SectionShell, StatusBadge } from "./SectionShell";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

const DAYS = [
  { idx: 0, label: "Domingo" },
  { idx: 1, label: "Lunes" },
  { idx: 2, label: "Martes" },
  { idx: 3, label: "Miércoles" },
  { idx: 4, label: "Jueves" },
  { idx: 5, label: "Viernes" },
  { idx: 6, label: "Sábado" },
];

export function HoursForm({ hours }: { hours: StoreHours[] }) {
  const [state, action] = useActionState(updateHoursAction, initial);
  const fe = state.fieldErrors ?? {};

  // Mapa por día para defaultValues
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  return (
    <form action={action} noValidate>
      <SectionShell
        id="horarios"
        title="Horarios de atención"
        description="Cuándo estás disponible para recibir pedidos. Aparece en el storefront."
        status={<StatusBadge ok={state.ok} error={state.error} />}
      >
        <div className="overflow-hidden rounded-xl border border-[color:var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--bg)] text-xs uppercase text-[color:var(--muted)]">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Día</th>
                <th className="px-4 py-2.5 text-left font-medium">Cerrado</th>
                <th className="px-4 py-2.5 text-left font-medium">Apertura</th>
                <th className="px-4 py-2.5 text-left font-medium">Cierre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {DAYS.map((d) => {
                const h = byDay.get(d.idx);
                const error = fe[`day_${d.idx}_open` as keyof typeof fe];
                return (
                  <tr key={d.idx}>
                    <td className="px-4 py-2.5 font-medium">{d.label}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        name={`day_${d.idx}_closed`}
                        defaultChecked={h?.isClosed ?? false}
                        className="size-4 rounded border-[color:var(--line-strong)] accent-[color:var(--color-amber-500)]"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="time"
                        name={`day_${d.idx}_open`}
                        defaultValue={h?.openTime ?? "09:00"}
                        aria-invalid={Boolean(error)}
                        className="rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-2 py-1 font-mono text-sm outline-none focus:border-[color:var(--color-amber-400)]"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div>
                        <input
                          type="time"
                          name={`day_${d.idx}_close`}
                          defaultValue={h?.closeTime ?? "21:00"}
                          aria-invalid={Boolean(error)}
                          className="rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-2 py-1 font-mono text-sm outline-none focus:border-[color:var(--color-amber-400)]"
                        />
                        {error && (
                          <p
                            role="alert"
                            className="mt-1 text-xs text-[color:var(--color-tomato-600)]"
                          >
                            {error}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SubmitButton />
      </SectionShell>
    </form>
  );
}
