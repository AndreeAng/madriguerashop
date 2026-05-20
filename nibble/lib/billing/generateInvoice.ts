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

  // `amount` se mantiene como `Prisma.Decimal` desde el plan hasta DB —
  // sin conversión a `Number` intermedia. Convertir el Decimal del plan a
  // float JS introduce error de representación IEEE-754 (ej. "99.90" →
  // 99.89999...) que persiste en la columna `Invoice.amount` y se filtra
  // a los emails. Para mostrar al usuario usamos `.toFixed(2)`.
  const amount =
    store.billingCycle === BillingCycle.YEARLY
      ? store.plan.yearlyPriceBob
      : store.plan.monthlyPriceBob;
  const billing = await getBillingSettings();
  // `dueDate = periodStart + dueDays`, NO `now + dueDays`. Si el cron se
  // atrasa (caída de Vercel, lock zombie, etc.) la factura se emite con
  // fecha correcta de período pero el dueDate quedaría desfasado dándole
  // al merchant menos plazo del contractualmente prometido y disparando
  // OVERDUE antes de lo debido. Anclar al período es determinista.
  const dueDate = addDays(periodStart, billing.dueDays);

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
          amount,
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
          // Pasamos `Number(amount)` solo en el límite del template (que
          // usa `formatBob` con 2 decimales). El Decimal canónico ya está
          // en DB; este Number es sólo para presentación.
          amount: amount.toNumber(),
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
        // `toFixed(2)` en lugar de Number() para preservar siempre 2
        // decimales en el JSON del audit (sino "99.90" se serializa "99.9").
        amount: amount.toFixed(2),
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

// Exportadas para tests unit. `priceForCycle` y `computePeriod` no tocan
// la DB — pueden testearse con fixtures planos.
export function priceForCycle(plan: Plan, cycle: BillingCycle): number {
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

/**
 * Cuántos días tiene un mes dado (0-indexado). `Date.UTC(year, month+1, 0)`
 * devuelve el último día del mes anterior al `month+1`, o sea el último día
 * de `month`.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function computePeriod(store: Store, now: Date) {
  // periodStart viene del contrato (nextInvoiceAt), no de cuando corra el cron.
  // Si el cron se atrasó un día, igual cubrimos el período correcto.
  const anchor = store.nextInvoiceAt ?? now;
  const periodStart = startOfDayBolivia(anchor);
  // Para el endDate, sumamos meses/años sobre el wall-clock Bolivia
  // (no sobre UTC) para que "12-mayo + 1 mes = 12-junio" sea la fecha
  // calendario, no esa fecha shifteada por TZ del servidor.
  const b = inBolivia(periodStart);

  // CLAMP: si el día del periodStart no existe en el mes/año destino
  // (ej. 31-ene + 1 mes = 31-feb, o 29-feb + 1 año en no-bisiesto),
  // ajustamos al ÚLTIMO día del mes destino en lugar de dejar que
  // `Date.UTC` haga overflow al mes siguiente. Sin el clamp, un cliente
  // contratado el 31-ene recibía la próxima factura el 3-mar (ciclo de
  // ~25 días en lugar de un mes completo) y el día de facturación
  // quedaba permanentemente desfasado del día contractual.
  let periodEnd: Date;
  let nextInvoiceAt: Date;
  if (store.billingCycle === BillingCycle.YEARLY) {
    const targetYear = b.year + 1;
    const targetMonth = b.month;
    const day = Math.min(b.day, daysInMonth(targetYear, targetMonth));
    periodEnd = dateInBolivia(targetYear, targetMonth, day, 0, 0, 0, 0);
    nextInvoiceAt = periodEnd;
  } else {
    // `b.month + 1` puede ser 12 (= enero del año siguiente). `daysInMonth`
    // y `dateInBolivia` aceptan eso vía la normalización estándar de `Date`.
    const targetYear = b.month === 11 ? b.year + 1 : b.year;
    const targetMonth = b.month === 11 ? 0 : b.month + 1;
    const day = Math.min(b.day, daysInMonth(targetYear, targetMonth));
    periodEnd = dateInBolivia(targetYear, targetMonth, day, 0, 0, 0, 0);
    nextInvoiceAt = periodEnd;
  }
  return { periodStart, periodEnd, nextInvoiceAt };
}

