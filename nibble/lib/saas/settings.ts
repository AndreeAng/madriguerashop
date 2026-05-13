import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SaasSettings } from "@prisma/client";

/**
 * Singleton de configuración global del SaaS. Toda la app lee de acá; el super
 * admin lo edita desde `/admin/settings`. El env var sólo se usa al primer
 * arranque (ver `ensureSaasSettings`) si no hay row todavía.
 *
 * Cache en memoria por 60s para evitar pegarle a la DB en cada read del cron
 * o checkout. Esta cache vive en proceso — en multi-instancia (Vercel
 * lambdas) cada réplica tiene su propio cache, así que un cambio desde la UI
 * tarda hasta TTL en reflejarse globalmente. Aceptable para settings que
 * cambian raramente.
 */

const CACHE_TTL_MS = 60_000;

let cached: { value: SaasSettings; expiresAt: number } | null = null;
// Promise singleton para deduplicar reads concurrentes con cache expirado.
// Sin esto, dos requests simultáneos hacen dos `ensureSaasSettings` en
// paralelo; si todavía no existe el row, ambos intentan create y uno falla.
let inflight: Promise<SaasSettings> | null = null;

export async function getSaasSettings(): Promise<SaasSettings> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (inflight) return inflight;

  inflight = ensureSaasSettings()
    .then((row) => {
      cached = { value: row, expiresAt: Date.now() + CACHE_TTL_MS };
      return row;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * Lee el row 'default'; si no existe, lo crea sembrando los valores actuales
 * de los env vars. Idempotente bajo race: si dos procesos llegan acá al
 * mismo tiempo, el `create` que pierde la race recibe P2002 y refetcheamos.
 */
async function ensureSaasSettings(): Promise<SaasSettings> {
  const existing = await db.saasSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;

  try {
    return await db.saasSettings.create({
      data: {
        id: "default",
        paymentQrUrl: process.env.SAAS_PAYMENT_QR_URL || null,
        paymentInstructions:
          process.env.SAAS_PAYMENT_INSTRUCTIONS ||
          "Escanea el QR y paga el monto exacto. Sube el comprobante para que verifiquemos.",
        billingInvoicePrefix: process.env.BILLING_INVOICE_PREFIX || "NIB-",
        billingDueDays: Number(process.env.BILLING_DUE_DAYS) || 7,
        billingGraceDays: Number(process.env.BILLING_GRACE_DAYS) || 5,
        featureDynamicQr: process.env.FEATURE_DYNAMIC_QR === "true",
        featureAiChatbot: process.env.FEATURE_AI_CHATBOT === "true",
        featureMultiBranch: process.env.FEATURE_MULTI_BRANCH === "true",
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Otro proceso ganó la race del create — refetch y devolver.
      const row = await db.saasSettings.findUnique({ where: { id: "default" } });
      if (row) return row;
    }
    throw err;
  }
}

/** Invalidar el cache después de un update desde la UI. */
export function invalidateSaasSettings(): void {
  cached = null;
}

/** Builder del invoiceNumber con el prefijo del singleton. */
export function formatInvoiceNumber(seq: number, prefix: string): string {
  return `${prefix}${String(seq).padStart(6, "0")}`;
}
