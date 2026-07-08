import type { StoreStatus, InvoiceStatus } from "@prisma/client";

/**
 * Decide qué aviso de cobranza mostrarle al dueño en su dashboard.
 *
 * Lógica PURA (sin DB) para poder testearla. El loader de datos vive en el
 * layout del dashboard: pasa el `status` de la tienda + la factura abierta más
 * próxima. Ver `docs/superpowers/specs/2026-07-08-dashboard-dunning-notice-design.md`.
 */

export type DunningLevel = "suspended" | "overdue" | "due_today" | "due_soon";

export type DunningNotice = {
  level: DunningLevel;
  /** Días hasta el vencimiento; null salvo para due_soon/due_today. */
  daysUntilDue: number | null;
} | null;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Días hasta el vencimiento — mismo cálculo que `sendReminders`
 * (`ceil((dueDate − now)/día)`), para que el aviso in-app y los emails
 * coincidan. Negativo si ya venció.
 */
function daysUntil(dueDate: Date, now: Date): number {
  return Math.ceil((dueDate.getTime() - now.getTime()) / DAY_MS);
}

export function computeDunningNotice(input: {
  status: StoreStatus;
  earliestOpenInvoice: { dueDate: Date; status: InvoiceStatus } | null;
  now: Date;
}): DunningNotice {
  const { status, earliestOpenInvoice, now } = input;

  // 1. Suspendida — máxima prioridad, sin importar facturas.
  if (status === "SUSPENDED") return { level: "suspended", daysUntilDue: null };

  const days = earliestOpenInvoice ? daysUntil(earliestOpenInvoice.dueDate, now) : null;

  // 2. Vencida: PAST_DUE, o la factura abierta más próxima ya venció (cubre el
  //    hueco cuando el cron `syncStoreStatuses` todavía no marcó PAST_DUE).
  if (status === "PAST_DUE" || (days !== null && days < 0)) {
    return { level: "overdue", daysUntilDue: null };
  }

  if (days === null) return null;

  // 3. Vence hoy.
  if (days === 0) return { level: "due_today", daysUntilDue: 0 };

  // 4. Vence pronto (dentro de 3 días).
  if (days >= 1 && days <= 3) return { level: "due_soon", daysUntilDue: days };

  // 5. Nada que avisar.
  return null;
}
