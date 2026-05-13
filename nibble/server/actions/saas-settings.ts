"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { invalidateSaasSettings } from "@/lib/saas/settings";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import type { ActionState } from "./store-settings";

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
    .regex(/^[A-Z0-9-]+$/i, "Sólo letras, números y guiones"),
  billingDueDays: z.coerce.number().int().min(0).max(60),
  billingGraceDays: z.coerce.number().int().min(0).max(30),
});

export async function updateSaasSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.SUPER_ADMIN) {
    return { error: "Sólo el super admin puede cambiar la configuración global." };
  }

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
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    target: "saas-settings",
    metadata: { changedFields: Object.keys(data) },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/facturacion");
  return { ok: true };
}
