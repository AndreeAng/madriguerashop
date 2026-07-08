import { describe, it, expect } from "vitest";
import { computeDunningNotice } from "@/lib/billing/dunning-notice";

/**
 * `computeDunningNotice` decide qué aviso de cobranza mostrarle al dueño en su
 * dashboard. Lógica pura. Prioridad: suspended › overdue › due_today › due_soon
 * › null. `daysUntilDue = ceil((dueDate−now)/día)`, igual que sendReminders.
 */

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const dueIn = (days: number) => new Date(NOW.getTime() + days * DAY);

describe("computeDunningNotice — por estado de la tienda", () => {
  it("SUSPENDED → suspended (aunque no haya factura)", () => {
    expect(
      computeDunningNotice({ status: "SUSPENDED", earliestOpenInvoice: null, now: NOW }),
    ).toEqual({ level: "suspended", daysUntilDue: null });
  });

  it("PAST_DUE con factura vencida → overdue", () => {
    expect(
      computeDunningNotice({
        status: "PAST_DUE",
        earliestOpenInvoice: { dueDate: dueIn(-2), status: "OVERDUE" },
        now: NOW,
      }),
    ).toMatchObject({ level: "overdue" });
  });
});

describe("computeDunningNotice — por vencimiento de factura (tienda ACTIVE)", () => {
  it("factura vencida aunque el status siga ACTIVE (cron no corrió) → overdue", () => {
    expect(
      computeDunningNotice({
        status: "ACTIVE",
        earliestOpenInvoice: { dueDate: dueIn(-1), status: "PENDING" },
        now: NOW,
      }),
    ).toMatchObject({ level: "overdue" });
  });

  it("vence hoy (daysUntilDue 0) → due_today", () => {
    expect(
      computeDunningNotice({
        status: "ACTIVE",
        earliestOpenInvoice: { dueDate: NOW, status: "PENDING" },
        now: NOW,
      }),
    ).toEqual({ level: "due_today", daysUntilDue: 0 });
  });

  it("vence en 1 día → due_soon con daysUntilDue 1", () => {
    expect(
      computeDunningNotice({
        status: "ACTIVE",
        earliestOpenInvoice: { dueDate: dueIn(1), status: "PENDING" },
        now: NOW,
      }),
    ).toEqual({ level: "due_soon", daysUntilDue: 1 });
  });

  it("vence en 3 días → due_soon con daysUntilDue 3 (borde superior)", () => {
    expect(
      computeDunningNotice({
        status: "ACTIVE",
        earliestOpenInvoice: { dueDate: dueIn(3), status: "PENDING" },
        now: NOW,
      }),
    ).toEqual({ level: "due_soon", daysUntilDue: 3 });
  });

  it("vence en 4 días → null (fuera de la ventana)", () => {
    expect(
      computeDunningNotice({
        status: "ACTIVE",
        earliestOpenInvoice: { dueDate: dueIn(4), status: "PENDING" },
        now: NOW,
      }),
    ).toBeNull();
  });

  it("sin factura abierta → null", () => {
    expect(
      computeDunningNotice({ status: "ACTIVE", earliestOpenInvoice: null, now: NOW }),
    ).toBeNull();
  });
});

describe("computeDunningNotice — prioridad", () => {
  it("SUSPENDED gana sobre una factura que recién vence", () => {
    expect(
      computeDunningNotice({
        status: "SUSPENDED",
        earliestOpenInvoice: { dueDate: dueIn(3), status: "PENDING" },
        now: NOW,
      }),
    ).toMatchObject({ level: "suspended" });
  });

  it("overdue gana sobre due_soon", () => {
    // PAST_DUE + una factura vencida: es overdue, no due_soon.
    expect(
      computeDunningNotice({
        status: "PAST_DUE",
        earliestOpenInvoice: { dueDate: dueIn(-5), status: "OVERDUE" },
        now: NOW,
      }),
    ).toMatchObject({ level: "overdue" });
  });
});
