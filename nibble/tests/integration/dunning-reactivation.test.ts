import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { syncStoreStatuses } from "@/lib/billing/syncStoreStatuses";
import { getBillingSettings } from "@/lib/billing/config";

/**
 * Huecos de la máquina de dunning que `billing.test.ts` no cubre:
 *
 *  1. REACTIVACIÓN — una tienda SUSPENDED (o PAST_DUE) que salda sus facturas
 *     debe volver a ACTIVE y limpiar `suspendedAt`/`suspendedReason`. Sin esto
 *     un cliente que paga se queda suspendido = pierde acceso a algo que pagó.
 *
 *  2. LÍMITE DE GRACIA — una factura OVERDUE cuyo `dueDate` cae DENTRO del
 *     período de gracia NO debe suspender la tienda. Suspender antes de tiempo
 *     corta el servicio a alguien que todavía está a tiempo de pagar.
 *
 * Requiere seed base (Plan starter, SaasSettings con graceDays).
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG_REACT = `test-react-${STAMP}`;
const SLUG_GRACE = `test-grace-${STAMP}`;
const TEST_SLUGS = [SLUG_REACT, SLUG_GRACE];
const DAY = 24 * 60 * 60 * 1000;

let templateId: string;
let planId: string;
let planMonthly: number;
let graceDays: number;

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst({ where: { slug: "starter" } });
  if (!template || !plan) {
    throw new Error("Test DB sin template/plan starter. Correr migrate deploy + db:seed.");
  }
  templateId = template.id;
  planId = plan.id;
  planMonthly = Number(plan.monthlyPriceBob);
  graceDays = (await getBillingSettings()).graceDays;
});

afterAll(async () => {
  await prisma.invoice.deleteMany({ where: { store: { slug: { in: TEST_SLUGS } } } });
  await prisma.store.deleteMany({ where: { slug: { in: TEST_SLUGS } } });
  await prisma.$disconnect();
});

function makeStore(slug: string, overrides: Record<string, unknown> = {}) {
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

describe("syncStoreStatuses — reactivación", () => {
  it("una tienda SUSPENDED sin facturas impagas vuelve a ACTIVE y limpia el motivo", async () => {
    const now = new Date();
    const store = await makeStore(SLUG_REACT, {
      status: "SUSPENDED",
      suspendedAt: new Date(now.getTime() - 10 * DAY),
      suspendedReason: "Factura vencida sin pago",
    });
    // Su única factura ya está PAGA → no quedan PENDING ni OVERDUE.
    await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-REACT-${STAMP}`,
        storeId: store.id,
        amount: planMonthly,
        periodStart: new Date(now.getTime() - 35 * DAY),
        periodEnd: new Date(now.getTime() - 5 * DAY),
        dueDate: new Date(now.getTime() - 5 * DAY),
        status: "PAID",
      },
    });

    await syncStoreStatuses({ now });

    const updated = await prisma.store.findUnique({ where: { id: store.id } });
    expect(updated!.status).toBe("ACTIVE");
    expect(updated!.suspendedAt).toBeNull();
    expect(updated!.suspendedReason).toBeNull();
  });
});

describe("syncStoreStatuses — límite de gracia", () => {
  it("una factura OVERDUE dentro de la gracia NO suspende (queda en PAST_DUE)", async () => {
    const now = new Date();
    const store = await makeStore(SLUG_GRACE, { status: "PAST_DUE" });
    // dueDate DENTRO de la ventana de gracia: graceCutoff = now - graceDays.
    // Usamos now - (graceDays - 1) días → estrictamente después del cutoff,
    // así que el paso de suspensión NO debe matchearla.
    const dueWithinGrace = new Date(now.getTime() - Math.max(0, graceDays - 1) * DAY);
    await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-GRACE-${STAMP}`,
        storeId: store.id,
        amount: planMonthly,
        periodStart: new Date(now.getTime() - 35 * DAY),
        periodEnd: dueWithinGrace,
        dueDate: dueWithinGrace,
        status: "OVERDUE",
      },
    });

    await syncStoreStatuses({ now });

    const updated = await prisma.store.findUnique({ where: { id: store.id } });
    expect(updated!.status).toBe("PAST_DUE"); // NO suspendida
    expect(updated!.suspendedAt).toBeNull();
  });
});
