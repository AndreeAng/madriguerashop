/**
 * Re-export para compatibilidad: la config real vive en `lib/saas/settings`.
 * Esta capa envuelve el singleton para callers que sólo necesitan los
 * 3 campos de billing.
 */
import { getSaasSettings, formatInvoiceNumber } from "@/lib/saas/settings";

export { formatInvoiceNumber };

export async function getBillingSettings(): Promise<{
  invoicePrefix: string;
  dueDays: number;
  graceDays: number;
}> {
  const s = await getSaasSettings();
  return {
    invoicePrefix: s.billingInvoicePrefix,
    dueDays: s.billingDueDays,
    graceDays: s.billingGraceDays,
  };
}
