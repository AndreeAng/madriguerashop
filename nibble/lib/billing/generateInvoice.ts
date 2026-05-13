import "server-only";
import { Prisma, BillingCycle, InvoiceStatus, Role, type Store, type Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { getBillingSettings, formatInvoiceNumber } from "./config";
import { sendEmailBackground } from "@/lib/email/send";
import { invoiceIssuedEmail } from "@/lib/email/templates/invoice-issued";
import { audit } from "@/lib/audit/log";
import { addDays } from "@/lib/utils";
import { dateInBolivia, inBolivia } from "@/lib/booking/timezone";

/**
 * Genera UNA factura para una tienda dada.
 *
 * Idempotencia: la combinación `(storeId, periodStart)` es UNIQUE en el
 * schema, así que si dos corridas del cron se solapan, la segunda obtiene
 * P2002 y devolvemos la factura que ganó la race en lugar de duplicar.
 *
 * `periodStart` se deriva de `store.nextInvoiceAt` (no de `now`) para que
 * los períodos contractuales no se solapen ni dejen huecos cuando el cron
 * pierde un día.
 */
export async function generateInvoice(
  storeId: string,
  opts: { now?: Date } = {},
): Promise<{ created: boolean; invoiceId: string; invoiceNumber: string }> {
  const now = opts.now ?? new Date();

  const store = await db.store.findUnique({
    where: { id: storeId },
    include: { plan: true },
  });
  if (!store) throw new Error(`Store ${storeId} not found`);

  const { periodStart, periodEnd, nextInvoiceAt } = computePeriod(store, now);

  // Optimistic check: si ya existe, devolver sin tocar nada.
  const preExisting = await db.invoice.findUnique({
    where: { storeId_periodStart: { storeId, periodStart } },
    select: { id: true, invoiceNumber: true },
  });
  if (preExisting) {
    return {
      created: false,
      invoiceId: preExisting.id,
      invoiceNumber: preExisting.invoiceNumber,
    };
  }

  const amount = priceForCycle(store.plan, store.billingCycle);
  const billing = await getBillingSettings();
  const dueDate = addDays(now, billing.dueDays);

  // Sequence atómica vía BillingCounter: el `update` con `increment` toma row
  // lock en Postgres, así que dos lambdas concurrentes obtienen seq distintos
  // sin colisión. Reemplaza el viejo `count()+attempt` que tenía race.
  try {
    const created = await db.$transaction(async (tx) => {
      const counter = await tx.billingCounter.upsert({
        where: { id: "invoice" },
        create: { id: "invoice", current: 1 },
        update: { current: { increment: 1 } },
        select: { current: true },
      });
      const invoiceNumber = formatInvoiceNumber(counter.current, billing.invoicePrefix);

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          storeId,
          amount: new Prisma.Decimal(amount),
          currency: "BOB",
          periodStart,
          periodEnd,
          status: InvoiceStatus.PENDING,
          dueDate,
        },
        select: { id: true, invoiceNumber: true },
      });
      await tx.store.update({
        where: { id: storeId },
        data: { nextInvoiceAt },
      });
      return inv;
    });

    // Email + audit fuera de la transacción para no atar I/O externo a la tx.
    const owner = await db.user.findFirst({
      where: { storeId, role: Role.STORE_OWNER, email: { not: null } },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    if (owner?.email) {
      sendEmailBackground(
        invoiceIssuedEmail({
          to: owner.email,
          storeName: store.name,
          invoiceNumber: created.invoiceNumber,
          amount,
          dueDate,
        }),
      );
    }

    await audit({
      storeId,
      action: "invoice.generated",
      target: created.id,
      metadata: {
        invoiceNumber: created.invoiceNumber,
        amount,
        dueDate: dueDate.toISOString(),
      },
    });

    return { created: true, invoiceId: created.id, invoiceNumber: created.invoiceNumber };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Si chocó la unique de (storeId, periodStart) — otra tx concurrente la
      // creó. Refetch y devolver. La unique de invoiceNumber ya no debería
      // colisionar gracias al BillingCounter atómico.
      const won = await db.invoice.findUnique({
        where: { storeId_periodStart: { storeId, periodStart } },
        select: { id: true, invoiceNumber: true },
      });
      if (won) {
        return { created: false, invoiceId: won.id, invoiceNumber: won.invoiceNumber };
      }
    }
    throw err;
  }
}

// ============== Helpers ==============

function priceForCycle(plan: Plan, cycle: BillingCycle): number {
  return cycle === BillingCycle.YEARLY
    ? Number(plan.yearlyPriceBob)
    : Number(plan.monthlyPriceBob);
}

/**
 * "Inicio del día" en hora Bolivia (BOT, UTC-4). Sin esto, el cron que
 * corre 23:00 BOT en un servidor UTC ve "03:00 UTC del día siguiente"
 * y la factura queda con `periodStart` del día siguiente al que el owner
 * percibe — además rompe `UNIQUE(storeId, periodStart)` cuando el
 * generador corre dos veces alrededor de medianoche BOT.
 */
function startOfDayBolivia(d: Date): Date {
  const b = inBolivia(d);
  return dateInBolivia(b.year, b.month, b.day, 0, 0, 0, 0);
}

function computePeriod(store: Store, now: Date) {
  // periodStart viene del contrato (nextInvoiceAt), no de cuando corra el cron.
  // Si el cron se atrasó un día, igual cubrimos el período correcto.
  const anchor = store.nextInvoiceAt ?? now;
  const periodStart = startOfDayBolivia(anchor);
  // Para el endDate, sumamos meses/años sobre el wall-clock Bolivia
  // (no sobre UTC) para que "12-mayo + 1 mes = 12-junio" sea la fecha
  // calendario, no esa fecha shifteada por TZ del servidor.
  const b = inBolivia(periodStart);

  let periodEnd: Date;
  let nextInvoiceAt: Date;
  if (store.billingCycle === BillingCycle.YEARLY) {
    periodEnd = dateInBolivia(b.year + 1, b.month, b.day, 0, 0, 0, 0);
    nextInvoiceAt = periodEnd;
  } else {
    periodEnd = dateInBolivia(b.year, b.month + 1, b.day, 0, 0, 0, 0);
    nextInvoiceAt = periodEnd;
  }
  return { periodStart, periodEnd, nextInvoiceAt };
}

