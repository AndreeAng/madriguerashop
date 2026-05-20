"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdminOrFail } from "@/lib/auth/session";
import {
  generateRecoveryTokenPlain,
  hashRecoveryToken,
} from "@/lib/auth/recovery-token";
import { sendEmailBackground } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import { appUrl } from "@/lib/email/client";
import { audit } from "@/lib/audit/log";
import { INVALID_INPUT_ERROR, type ActionState } from "@/lib/validation/actionState";

const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hora — igual que el flow normal
const USER_ERROR_MSG = "Sólo el super admin puede gestionar usuarios.";

// ============== Suspender / Reactivar ==============

const idSchema = z.object({ userId: z.string().min(1) });

export async function suspendUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(USER_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = idSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  if (parsed.data.userId === admin.id) {
    return { error: "No puedes suspender tu propia cuenta." };
  }

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true, isActive: true, username: true },
  });
  if (!target) return { error: "Usuario no encontrado." };
  if (target.role === Role.SUPER_ADMIN) {
    return { error: "No se puede suspender un super admin desde la UI." };
  }
  if (!target.isActive) return { ok: true };

  // Suspender. La sesión JWT del usuario se invalida en su próxima request
  // dentro de JWT_REVALIDATE_MS (60s, ver `auth.ts:50`) — el callback jwt
  // re-consulta isActive contra la DB y retorna null cuando lo encuentra false.
  await db.user.update({
    where: { id: target.id },
    data: { isActive: false },
  });

  await audit({
    action: "saas.user_suspended",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    target: target.id,
    metadata: { username: target.username },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function reactivateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(USER_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = idSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, isActive: true, username: true },
  });
  if (!target) return { error: "Usuario no encontrado." };
  if (target.isActive) return { ok: true };

  await db.user.update({ where: { id: target.id }, data: { isActive: true } });

  await audit({
    action: "saas.user_reactivated",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    target: target.id,
    metadata: { username: target.username },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

// ============== Reset password (manda email) ==============

export async function sendPasswordResetForUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(USER_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = idSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, username: true, isActive: true },
  });
  if (!target) return { error: "Usuario no encontrado." };
  if (!target.email) {
    return { error: "Este usuario no tiene email — no se puede mandar el reset." };
  }
  if (!target.isActive) {
    return { error: "Usuario suspendido. Reactívalo primero." };
  }

  // En DB guardamos el hash del token; el plano viaja solo por email.
  const tokenPlain = generateRecoveryTokenPlain();
  const tokenHash = hashRecoveryToken(tokenPlain);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.$transaction([
    db.passwordReset.updateMany({
      where: { userId: target.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordReset.create({
      data: { userId: target.id, token: tokenHash, expiresAt },
    }),
  ]);

  const resetUrl = `${appUrl()}/recovery/${tokenPlain}`;
  sendEmailBackground(passwordResetEmail({ to: target.email, resetUrl, expiresAt }));

  await audit({
    action: "saas.user_password_reset_sent",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    target: target.id,
    metadata: { username: target.username, email: target.email },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

// ============== Cambiar rol ==============

const roleSchema = z.object({
  userId: z.string().min(1),
  toRole: z.enum(["STORE_OWNER", "CASHIER"]),
});

export async function changeUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(USER_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    toRole: formData.get("toRole"),
  });
  if (!parsed.success) return { error: "Rol inválido. Sólo STORE_OWNER ↔ CASHIER." };

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true, storeId: true, username: true },
  });
  if (!target) return { error: "Usuario no encontrado." };
  if (target.role === Role.SUPER_ADMIN) {
    return { error: "No se puede cambiar el rol de un super admin desde la UI." };
  }
  if (!target.storeId) {
    return { error: "Este usuario no tiene tienda asignada." };
  }
  if (target.role === parsed.data.toRole) return { ok: true };

  // Si bajamos un OWNER a CASHIER, validar que la tienda no quede sin owner.
  if (target.role === Role.STORE_OWNER && parsed.data.toRole === "CASHIER") {
    const otherOwners = await db.user.count({
      where: {
        storeId: target.storeId,
        role: Role.STORE_OWNER,
        isActive: true,
        id: { not: target.id },
      },
    });
    if (otherOwners === 0) {
      return {
        error:
          "Esta tienda quedaría sin dueño. Asigna a otro usuario como STORE_OWNER antes de bajar a CASHIER.",
      };
    }
  }

  await db.user.update({
    where: { id: target.id },
    data: { role: parsed.data.toRole },
  });

  await audit({
    action: "saas.user_role_changed",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    target: target.id,
    metadata: { username: target.username, from: target.role, to: parsed.data.toRole },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
