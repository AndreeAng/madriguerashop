import "server-only";
import { db } from "@/lib/db";
import { generateInvoice } from "./generateInvoice";

/**
 * Encuentra todas las tiendas con `nextInvoiceAt <= now` y emite una factura
 * por cada una.
 *
 * Pensado para correr 1×/día desde un cron.
 *
 * @returns resumen para logs / monitoring
 */
export async function runBillingCycle(opts: { now?: Date } = {}): Promise<{
  storesProcessed: number;
  invoicesCreated: number;
  errors: { storeId: string; error: string }[];
}> {
  const now = opts.now ?? new Date();

  // Tiendas a facturar:
  //  - Status ACTIVE o PAST_DUE (las suspendidas no se facturan)
  //  - nextInvoiceAt definido y vencido
  // Las TRIAL son legacy (de antes de eliminar el período de prueba); si todavía
  // queda alguna en DB, la incluimos para que reciba su primera factura.
  const candidates = await db.store.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE", "TRIAL"] },
      nextInvoiceAt: { lte: now },
    },
    select: { id: true, slug: true },
  });

  let invoicesCreated = 0;
  const errors: { storeId: string; error: string }[] = [];

  for (const store of candidates) {
    try {
      const res = await generateInvoice(store.id, { now });
      if (res.created) invoicesCreated++;
    } catch (err) {
      errors.push({
        storeId: store.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    storesProcessed: candidates.length,
    invoicesCreated,
    errors,
  };
}
