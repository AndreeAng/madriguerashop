import { describe, it, expect } from "vitest";
import { BillingCycle, Prisma, type Store, type Plan } from "@prisma/client";
import { computePeriod, priceForCycle } from "@/lib/billing/generateInvoice";

// Fixture mínimo del Store. `computePeriod` solo lee `nextInvoiceAt` y
// `billingCycle`, así que ignoramos campos irrelevantes con `as Store`.
function makeStore(overrides: Partial<Store>): Store {
  return {
    nextInvoiceAt: null,
    billingCycle: BillingCycle.MONTHLY,
    ...overrides,
  } as Store;
}

function makePlan(monthly: string, yearly: string): Plan {
  return {
    monthlyPriceBob: new Prisma.Decimal(monthly),
    yearlyPriceBob: new Prisma.Decimal(yearly),
  } as Plan;
}

describe("priceForCycle", () => {
  it("retorna monthlyPriceBob para MONTHLY", () => {
    const plan = makePlan("199.00", "1990.00");
    expect(priceForCycle(plan, BillingCycle.MONTHLY)).toBe(199);
  });

  it("retorna yearlyPriceBob para YEARLY", () => {
    const plan = makePlan("199.00", "1990.00");
    expect(priceForCycle(plan, BillingCycle.YEARLY)).toBe(1990);
  });

  it("preserva decimales", () => {
    const plan = makePlan("99.99", "999.99");
    expect(priceForCycle(plan, BillingCycle.MONTHLY)).toBe(99.99);
  });
});

describe("computePeriod (MONTHLY)", () => {
  it("anchor = nextInvoiceAt cuando existe", () => {
    // 2026-05-12T04:00:00Z = 00:00 BOT del 12-may-2026
    const anchor = new Date("2026-05-12T04:00:00Z");
    const store = makeStore({
      nextInvoiceAt: anchor,
      billingCycle: BillingCycle.MONTHLY,
    });
    const now = new Date("2026-05-15T10:00:00Z"); // cron corre 3 días después
    const { periodStart, periodEnd, nextInvoiceAt } = computePeriod(store, now);
    // periodStart = 00:00 BOT del 12-may (anclado a nextInvoiceAt)
    expect(periodStart.toISOString()).toBe("2026-05-12T04:00:00.000Z");
    // periodEnd = 12-jun
    expect(periodEnd.toISOString()).toBe("2026-06-12T04:00:00.000Z");
    expect(nextInvoiceAt.toISOString()).toBe(periodEnd.toISOString());
  });

  it("anchor = now cuando nextInvoiceAt es null", () => {
    const store = makeStore({
      nextInvoiceAt: null,
      billingCycle: BillingCycle.MONTHLY,
    });
    // 2026-05-15T14:00:00Z = 10:00 BOT del 15-may
    const now = new Date("2026-05-15T14:00:00Z");
    const { periodStart, periodEnd } = computePeriod(store, now);
    // Trunca a inicio del día BOT
    expect(periodStart.toISOString()).toBe("2026-05-15T04:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-06-15T04:00:00.000Z");
  });

  it("truncado a hora Bolivia (no UTC)", () => {
    // 2026-05-12T02:00:00Z = 22:00 BOT del 11-may (cruzando medianoche)
    // El startOfDayBolivia debe devolver 00:00 BOT del 11-may, NO del 12.
    const anchor = new Date("2026-05-12T02:00:00Z");
    const store = makeStore({ nextInvoiceAt: anchor });
    const { periodStart } = computePeriod(store, new Date());
    // 00:00 BOT del 11-may = 04:00 UTC del 11-may
    expect(periodStart.toISOString()).toBe("2026-05-11T04:00:00.000Z");
  });

  it("período cruzando fin de año", () => {
    // anchor 15-dic → end 15-ene del año siguiente
    const anchor = new Date("2026-12-15T04:00:00Z");
    const store = makeStore({
      nextInvoiceAt: anchor,
      billingCycle: BillingCycle.MONTHLY,
    });
    const { periodEnd } = computePeriod(store, new Date());
    expect(periodEnd.toISOString()).toBe("2027-01-15T04:00:00.000Z");
  });

  it("período en mes con 31 días → mes con 30 días", () => {
    // 31-ene → 28-feb (no 31-feb que no existe). Date.UTC normaliza
    // mes overflow, así que termina en 03-mar. Es comportamiento conocido
    // de la aritmética de meses con Date — documentado.
    const anchor = new Date("2026-01-31T04:00:00Z");
    const store = makeStore({
      nextInvoiceAt: anchor,
      billingCycle: BillingCycle.MONTHLY,
    });
    const { periodEnd } = computePeriod(store, new Date());
    // 2026 no es bisiesto → feb tiene 28 → 31+28 = mar-03
    expect(periodEnd.toISOString()).toBe("2026-03-03T04:00:00.000Z");
  });
});

describe("computePeriod (YEARLY)", () => {
  it("período de un año exacto", () => {
    const anchor = new Date("2026-05-12T04:00:00Z");
    const store = makeStore({
      nextInvoiceAt: anchor,
      billingCycle: BillingCycle.YEARLY,
    });
    const { periodStart, periodEnd, nextInvoiceAt } = computePeriod(
      store,
      new Date(),
    );
    expect(periodStart.toISOString()).toBe("2026-05-12T04:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2027-05-12T04:00:00.000Z");
    expect(nextInvoiceAt.toISOString()).toBe(periodEnd.toISOString());
  });

  it("año bisiesto: 29-feb → 28-feb del año siguiente (no bisiesto)", () => {
    // 2028 es bisiesto, 2029 no. 29-feb-2028 + 1 año → Date.UTC(2029, 1, 29)
    // normaliza a 01-mar-2029. Documentar el comportamiento.
    const anchor = new Date("2028-02-29T04:00:00Z");
    const store = makeStore({
      nextInvoiceAt: anchor,
      billingCycle: BillingCycle.YEARLY,
    });
    const { periodEnd } = computePeriod(store, new Date());
    expect(periodEnd.toISOString()).toBe("2029-03-01T04:00:00.000Z");
  });
});
