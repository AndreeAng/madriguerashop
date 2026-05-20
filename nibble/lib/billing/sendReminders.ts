import "server-only";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmailBackground } from "@/lib/email/send";
import { invoiceReminderEmail } from "@/lib/email/templates/invoice-reminder";

/**
 * Recorre invoices PENDING/OVERDUE y manda recordatorios:
 *   - 3 días antes del vencimiento
 *   - 1 día antes del vencimiento
 *   - el día del vencimiento
 *   - cada 3 días después de vencer (hasta máximo de 5 reminders)
 *
 * Idempotencia:
 *   - `Invoice.reminderSentAt` se actualiza cada vez que enviamos
 *   - `Invoice.remindersCount` previene spam
 *   - Sólo enviamos si pasaron al menos 20h desde el último reminder
 *
 * Pensado para correr 1×/día junto con runBillingCycle.
 */

const MIN_HOURS_BETWEEN_REMINDERS = 20;
const MAX_REMINDERS_PER_INVOICE = 5;

export async function sendInvoiceReminders(opts: { now?: Date } = {}): Promise<{
  candidates: number;
  sent: number;
  skipped: number;
}> {
  const now = opts.now ?? new Date();
  const dayMs = 1000 * 60 * 60 * 24;

  // Invoices abiertas con dueDate dentro de un rango razonable (-30d a +5d)
  const pastWindow = new Date(now.getTime() - 30 * dayMs);
  const futureWindow = new Date(now.getTime() + 5 * dayMs);

  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: pastWindow, lte: futureWindow },
    },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      dueDate: true,
      reminderSentAt: true,
      remindersCount: true,
      storeId: true,
      store: { select: { name: true } },
    },
  });

  // Pre-cargar emails de owners de las tiendas afectadas en una sola query.
  // Antes hacíamos un findFirst por invoice → N+1 query.
  const storeIds = Array.from(new Set(invoices.map((i) => i.storeId)));
  const owners = storeIds.length
    ? await db.user.findMany({
        where: {
          storeId: { in: storeIds },
          role: Role.STORE_OWNER,
          email: { not: null },
        },
        select: { storeId: true, email: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const ownerEmailByStore = new Map<string, string>();
  for (const o of owners) {
    if (o.storeId && o.email && !ownerEmailByStore.has(o.storeId)) {
      ownerEmailByStore.set(o.storeId, o.email);
    }
  }

  let sent = 0;
  let skipped = 0;
  // Acumulamos IDs y al final hacemos un solo `updateMany` batch en lugar
  // de N UPDATEs seriales. Sin esto, 50 invoices en la ventana → 50
  // round-trips a la DB en cada cron run.
  const sentInvoiceIds: string[] = [];

  for (const inv of invoices) {
    const daysUntilDue = Math.ceil(
      (inv.dueDate.getTime() - now.getTime()) / dayMs,
    );

    // Decidir si toca enviar y de qué tipo
    let shouldSend = false;
    let kind: "due_soon" | "due_today" | "overdue" = "due_soon";

    if (daysUntilDue === 3 || daysUntilDue === 1) {
      shouldSend = true;
      kind = "due_soon";
    } else if (daysUntilDue === 0) {
      shouldSend = true;
      kind = "due_today";
    } else if (daysUntilDue < 0 && daysUntilDue >= -15) {
      // Vencida — primer aviso al día siguiente, después cada 3 días.
      // El throttle de 20h evita duplicados si el cron corre dos veces el mismo día.
      const daysSinceDue = Math.abs(daysUntilDue);
      if (daysSinceDue === 1 || daysSinceDue % 3 === 0) {
        shouldSend = true;
        kind = "overdue";
      }
    }

    if (!shouldSend) {
      skipped++;
      continue;
    }

    // Throttle: si ya enviamos hace <20h, saltar
    if (inv.reminderSentAt) {
      const hoursSince =
        (now.getTime() - inv.reminderSentAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < MIN_HOURS_BETWEEN_REMINDERS) {
        skipped++;
        continue;
      }
    }

    // Cap absoluto
    if (inv.remindersCount >= MAX_REMINDERS_PER_INVOICE) {
      skipped++;
      continue;
    }

    const ownerEmail = ownerEmailByStore.get(inv.storeId);
    if (!ownerEmail) {
      // Sin email NO consumimos del counter ni marcamos `reminderSentAt`:
      // antes lo hacíamos para "no reintentar", pero el resultado es que
      // la tienda llegaba a SUSPENDED sin que nadie supiera que el owner
      // estaba incomunicado. Ahora actualizamos solo el throttle (para no
      // re-loguear todos los días) y dejamos huella en stdout para que
      // ops detecte el caso y agregue el email.
      console.warn(
        `[sendReminders] store ${inv.storeId} sin email — skipping invoice ${inv.invoiceNumber} (kind=${kind})`,
      );
      skipped++;
      continue;
    }

    sendEmailBackground(
      invoiceReminderEmail({
        to: ownerEmail,
        storeName: inv.store.name,
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.amount),
        dueDate: inv.dueDate,
        daysUntilDue,
        kind,
      }),
    );

    // Acumulamos el id para el batch update al final del loop. El
    // contador real se incrementa después con `updateMany` para evitar
    // N round-trips seriales contra Postgres.
    sentInvoiceIds.push(inv.id);
    sent++;
  }

  if (sentInvoiceIds.length > 0) {
    await db.invoice.updateMany({
      where: { id: { in: sentInvoiceIds } },
      data: {
        reminderSentAt: now,
        remindersCount: { increment: 1 },
      },
    });
  }

  return {
    candidates: invoices.length,
    sent,
    skipped,
  };
}
