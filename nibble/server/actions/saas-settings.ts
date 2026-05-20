"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdminOrFail } from "@/lib/auth/session";
import { invalidateSaasSettings } from "@/lib/saas/settings";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import type { ActionState } from "@/lib/validation/actionState";

// `featureDynamicQr`, `featureAiChatbot`, `featureMultiBranch` se removieron
// del schema y del UI: los toggles eran decorativos, ningún action los leía.
// Los campos persisten en `SaasSettings` (Prisma) reservados para cuando se
// implementen los features V2 — entonces se re-agregan acá con la lógica real.
const settingsSchema = z.object({
  paymentQrUrl: z.string().trim().url().or(z.literal("")).optional(),
  paymentInstructions: z.string().trim().min(10).max(1000),
  billingInvoicePrefix: z
    .string()
    .trim()
    .min(2)
    .max(8)
    // Debe empezar y terminar con alfanumérico — un prefijo como `---` o
    // `-ABC-` generaría números de factura tipo `---00001` que rompen
    // integraciones contables externas y validaciones del SIN sobre
    // formato del prefijo de la serie.
    .regex(
      /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i,
      "Sólo letras y números; los guiones solo pueden ir en medio",
    ),
  // Mínimo 3 días de plazo para que el merchant pague sin sorpresas.
  // Con 0 días la factura vence el mismo día de emisión y `syncStoreStatuses`
  // la marca OVERDUE al día siguiente — peor experiencia que el SaaS más
  // hostil del mercado.
  billingDueDays: z.coerce.number().int().min(3).max(60),
  // Mínimo 1 día de gracia post-vencimiento antes de suspender. Con 0 días
  // de gracia, una tienda recién pasada a OVERDUE puede pasar a SUSPENDED
  // en el siguiente run del cron (mismo día) sin tiempo de respuesta.
  billingGraceDays: z.coerce.number().int().min(1).max(30),
});

export async function updateSaasSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireSuperAdminOrFail(
    "Sólo el super admin puede cambiar la configuración global.",
  );
  if ("error" in guard) return { error: guard.error };

  const parsed = settingsSchema.safeParse({
    paymentQrUrl: formData.get("paymentQrUrl"),
    paymentInstructions: formData.get("paymentInstructions"),
    billingInvoicePrefix: formData.get("billingInvoicePrefix"),
    billingDueDays: formData.get("billingDueDays"),
    billingGraceDays: formData.get("billingGraceDays"),
  });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<string>(parsed.error) };
  }

  const data = parsed.data;

  await db.saasSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      paymentQrUrl: data.paymentQrUrl || null,
      paymentInstructions: data.paymentInstructions,
      billingInvoicePrefix: data.billingInvoicePrefix.toUpperCase(),
      billingDueDays: data.billingDueDays,
      billingGraceDays: data.billingGraceDays,
    },
    update: {
      paymentQrUrl: data.paymentQrUrl || null,
      paymentInstructions: data.paymentInstructions,
      billingInvoicePrefix: data.billingInvoicePrefix.toUpperCase(),
      billingDueDays: data.billingDueDays,
      billingGraceDays: data.billingGraceDays,
    },
  });

  invalidateSaasSettings();

  await audit({
    action: "saas.settings_changed",
    actorId: guard.id,
    actorRole: "SUPER_ADMIN",
    target: "saas-settings",
    metadata: { changedFields: Object.keys(data) },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/facturacion");
  return { ok: true };
}
