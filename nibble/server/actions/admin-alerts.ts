"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdminOrFail } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { INVALID_INPUT_ERROR, type ActionState } from "@/lib/validation/actionState";

const ALERT_ERROR_MSG = "Sólo el super admin puede gestionar alertas.";

const idSchema = z.object({ alertId: z.string().min(1) });

export async function acknowledgeAlertAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(ALERT_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = idSchema.safeParse({ alertId: formData.get("alertId") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  const alert = await db.alert.findUnique({
    where: { id: parsed.data.alertId },
    select: { id: true, status: true, storeId: true, type: true },
  });
  if (!alert) return { error: "Alerta no encontrada." };
  if (alert.status !== "OPEN") return { ok: true };

  await db.alert.update({
    where: { id: alert.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedById: admin.id,
    },
  });

  await audit({
    action: "saas.alert_acknowledged",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    storeId: alert.storeId,
    target: alert.id,
    metadata: { type: alert.type },
  });

  revalidatePath("/admin/alertas");
  return { ok: true };
}

export async function resolveAlertAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(ALERT_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = idSchema.safeParse({ alertId: formData.get("alertId") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  const alert = await db.alert.findUnique({
    where: { id: parsed.data.alertId },
    select: { id: true, status: true, storeId: true, type: true },
  });
  if (!alert) return { error: "Alerta no encontrada." };
  if (alert.status === "RESOLVED") return { ok: true };

  await db.alert.update({
    where: { id: alert.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedById: admin.id,
    },
  });

  await audit({
    action: "saas.alert_resolved",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    storeId: alert.storeId,
    target: alert.id,
    metadata: { type: alert.type },
  });

  revalidatePath("/admin/alertas");
  return { ok: true };
}
