import "server-only";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getBillingSettings } from "./config";
import { sendEmailBackground } from "@/lib/email/send";
import { storeSuspendedEmail } from "@/lib/email/templates/invoice-reminder";
import { addDays } from "@/lib/utils";

/**
 * Sincroniza el estado de las tiendas según sus invoices vencidas.
 *
 * Reglas:
 *  - Invoice PENDING + dueDate < now → marcamos invoice como OVERDUE
 *    + tienda → PAST_DUE (si todavía estaba ACTIVE).
 *  - Invoice OVERDUE + dueDate + graceDays < now → tienda → SUSPENDED.
 *  - Invoice PAID → si todas las invoices anteriores están pagas, tienda → ACTIVE.
 *
 * Diseñado para correr 1×/día junto con runBillingCycle, o más seguido.
 */
export async function syncStoreStatuses(opts: { now?: Date } = {}): Promise<{
  invoicesMarkedOverdue: number;
  storesMarkedPastDue: number;
  storesSuspended: number;
  storesReactivated: number;
}> {
  const now = opts.now ?? new Date();
  const billing = await getBillingSettings();
  const graceCutoff = addDays(now, -billing.graceDays);

  // 1. PENDING vencidas → OVERDUE (no tocamos status de la tienda acá; lo hace el paso 2)
  const overdueResult = await db.invoice.updateMany({
    where: { status: "PENDING", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });

  // 2. Tiendas ACTIVE con cualquier OVERDUE → PAST_DUE
  // (incluso fuera del grace: garantizamos que toda tienda pase por PAST_DUE
  // antes de SUSPENDED, aunque el cron haya perdido un día.)
  const pastDueStores = await db.store.findMany({
    where: {
      status: "ACTIVE",
      invoices: { some: { status: "OVERDUE" } },
    },
    select: { id: true },
  });
  const pastDueIds = pastDueStores.map((s) => s.id);
  const justMovedToPastDue = new Set(pastDueIds);
  if (pastDueIds.length > 0) {
    await db.store.updateMany({
      where: { id: { in: pastDueIds } },
      data: { status: "PAST_DUE" },
    });
  }

  // 3. Tiendas PAST_DUE con OVERDUE más allá del grace → SUSPENDED
  // (sólo desde PAST_DUE; además excluimos las que recién pasaron a PAST_DUE
  // en este mismo run — sino una tienda puede saltar ACTIVE→PAST_DUE→SUSPENDED
  // en una corrida sola si el cron perdió varios días.)
  const suspendStoresRaw = await db.store.findMany({
    where: {
      status: "PAST_DUE",
      invoices: {
        some: { status: "OVERDUE", dueDate: { lt: graceCutoff } },
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      users: {
        where: { role: Role.STORE_OWNER, email: { not: null } },
        select: { email: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const suspendStores = suspendStoresRaw.filter((s) => !justMovedToPastDue.has(s.id));
  if (suspendStores.length > 0) {
    // Update batch — todas las tiendas a suspender toman los mismos valores.
    await db.store.updateMany({
      where: { id: { in: suspendStores.map((s) => s.id) } },
      data: {
        status: "SUSPENDED",
        suspendedAt: now,
        suspendedReason: "Factura vencida sin pago",
      },
    });

    // Notificación: una por owner. Fire-and-forget, no se pueden batchear.
    for (const s of suspendStores) {
      const ownerEmail = s.users[0]?.email;
      if (ownerEmail) {
        sendEmailBackground(
          storeSuspendedEmail({
            to: ownerEmail,
            storeName: s.name,
            storeSlug: s.slug,
          }),
        );
      }
    }
  }

  // 4. Reactivación: tiendas PAST_DUE/SUSPENDED sin invoices PENDING/OVERDUE → ACTIVE
  const reactivateStores = await db.store.findMany({
    where: {
      status: { in: ["PAST_DUE", "SUSPENDED"] },
      invoices: {
        none: { status: { in: ["PENDING", "OVERDUE"] } },
      },
    },
    select: { id: true },
  });
  if (reactivateStores.length > 0) {
    await db.store.updateMany({
      where: { id: { in: reactivateStores.map((s) => s.id) } },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        suspendedReason: null,
      },
    });
  }

  return {
    invoicesMarkedOverdue: overdueResult.count,
    storesMarkedPastDue: pastDueStores.length,
    storesSuspended: suspendStores.length,
    storesReactivated: reactivateStores.length,
  };
}

