import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runBillingCycle } from "@/lib/billing/runBillingCycle";
import { syncStoreStatuses } from "@/lib/billing/syncStoreStatuses";

/**
 * Integración del ciclo de facturación SaaS contra Postgres real.
 *
 * Cubre los invariantes de ingresos que no se pueden testear en unit:
 *   - runBillingCycle emite exactamente UNA factura por período (idempotente
 *     vía el unique (storeId, periodStart)) y avanza nextInvoiceAt.
 *   - syncStoreStatuses transiciona PENDING→OVERDUE y suspende tras la gracia.
 *
 * Requiere que la test DB tenga el seed base (Plan starter, SaasSettings,
 * BillingCounter). Ver vitest.config.integration.mts para el setup.
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG_BILLING = `test-billing-${STAMP}`;
const SLUG_SUSPEND = `test-suspend-${STAMP}`;
const SLUG_OVERDUE = `test-overdue-${STAMP}`;
const TEST_SLUGS = [SLUG_BILLING, SLUG_SUSPEND, SLUG_OVERDUE];

let templateId: string;
let planId: string;
let planMonthly: number;

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst({ where: { slug: "starter" } });
  if (!template || !plan) {
    throw new Error(
      "Test DB sin template/plan starter. Correr migrate deploy + db:seed.",
    );
  }
  templateId = template.id;
  planId = plan.id;
  planMonthly = Number(plan.monthlyPriceBob);
});

afterAll(async () => {
  // FK order: Invoice → Store.
  await prisma.invoice.deleteMany({ where: { store: { slug: { in: TEST_SLUGS } } } });
  await prisma.store.deleteMany({ where: { slug: { in: TEST_SLUGS } } });
  await prisma.$disconnect();
});

async function makeStore(slug: string, overrides: Record<string, unknown> = {}) {
  return prisma.store.create({
    data: {
      slug,
      name: `Store ${slug}`,
      vertical: "RETAIL",
      templateId,
      planId,
      whatsappPhone: "+59170000000",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      ...overrides,
    },
  });
}

describe("runBillingCycle", () => {
  it("emite una factura para una tienda con nextInvoiceAt vencido", async () => {
    const now = new Date();
    const store = await makeStore(SLUG_BILLING, {
      nextInvoiceAt: new Date(now.getTime() - 2 * DAY),
    });

    const res = await runBillingCycle({ now });

    expect(res.errors).toEqual([]);
    expect(res.invoicesCreated).toBeGreaterThanOrEqual(1);

    const invoices = await prisma.invoice.findMany({ where: { storeId: store.id } });
    expect(invoices).toHaveLength(1);
    // El monto sale del plan, no de un valor hardcodeado en el cliente.
    expect(Number(invoices[0]!.amount)).toBe(planMonthly);

    // nextInvoiceAt avanzó al futuro para no re-facturar el mismo período.
    const updated = await prisma.store.findUnique({ where: { id: store.id } });
    expect(updated!.nextInvoiceAt!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("es idempotente: correr de nuevo el mismo período NO duplica la factura", async () => {
    // La tienda ya facturó arriba; su nextInvoiceAt quedó en el futuro.
    // Un segundo run con el mismo `now` no debe crear otra factura.
    const now = new Date();
    const store = await prisma.store.findUnique({ where: { slug: SLUG_BILLING } });
    const before = await prisma.invoice.count({ where: { storeId: store!.id } });

    await runBillingCycle({ now });

    const after = await prisma.invoice.count({ where: { storeId: store!.id } });
    expect(after).toBe(before);
  });
});

describe("syncStoreStatuses", () => {
  it("marca una factura PENDING vencida como OVERDUE", async () => {
    const now = new Date();
    const store = await makeStore(SLUG_OVERDUE);
    await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-OVD-${STAMP}`,
        storeId: store.id,
        amount: planMonthly,
        periodStart: new Date(now.getTime() - 35 * DAY),
        periodEnd: new Date(now.getTime() - 5 * DAY),
        dueDate: new Date(now.getTime() - 5 * DAY), // vencida hace 5 días
        status: "PENDING",
      },
    });

    await syncStoreStatuses({ now });

    const inv = await prisma.invoice.findUnique({
      where: { invoiceNumber: `TEST-OVD-${STAMP}` },
    });
    expect(inv!.status).toBe("OVERDUE");
  });

  it("NO salta ACTIVE→SUSPENDED en una sola corrida (safety guard)", async () => {
    // Invariante deliberado: aunque el cron pierda días, una tienda ACTIVE
    // primero pasa por PAST_DUE y solo se suspende en la CORRIDA SIGUIENTE.
    // Esto evita suspender de golpe si el cron estuvo caído.
    const now = new Date();
    const store = await makeStore(SLUG_SUSPEND);
    // dueDate 90 días atrás supera cualquier graceDays razonable (3-7 días).
    await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-SUSP-${STAMP}`,
        storeId: store.id,
        amount: planMonthly,
        periodStart: new Date(now.getTime() - 120 * DAY),
        periodEnd: new Date(now.getTime() - 90 * DAY),
        dueDate: new Date(now.getTime() - 90 * DAY),
        status: "OVERDUE",
      },
    });

    // Primera corrida: ACTIVE → PAST_DUE (todavía NO suspendida).
    await syncStoreStatuses({ now });
    let updated = await prisma.store.findUnique({ where: { id: store.id } });
    expect(updated!.status).toBe("PAST_DUE");

    // Segunda corrida: PAST_DUE + OVERDUE fuera de gracia → SUSPENDED.
    await syncStoreStatuses({ now });
    updated = await prisma.store.findUnique({ where: { id: store.id } });
    expect(updated!.status).toBe("SUSPENDED");
    expect(updated!.suspendedReason).toBeTruthy();
  });
});
