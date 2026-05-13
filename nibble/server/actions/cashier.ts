"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizeIdentifier } from "@/lib/auth/identifiers";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";

// ============== Tipos ==============

export type InviteCashierState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "identifier" | "password", string>
  >;
};

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  identifier: z.string().trim().min(1, "Email o teléfono requerido").max(120),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

// ============== Invitar cashier ==============

export async function inviteCashierAction(
  _prev: InviteCashierState,
  formData: FormData,
): Promise<InviteCashierState> {
  // Solo el owner crea cashiers. SUPER_ADMIN impersonando también puede
  // (lo cubre `requireOwnerOnlyIds` que acepta SUPER_ADMIN con la cookie).
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<InviteCashierState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  // Plan limit: el plan define cuántos cashiers puede tener la tienda.
  // Si llegó al tope, el owner debe suspender alguno antes de invitar otro.
  const { checkStaffLimit, staffLimitMessage } = await import(
    "@/lib/billing/plan-limits"
  );
  const limit = await checkStaffLimit(storeId);
  if (limit.exceeded) {
    return { error: staffLimitMessage(limit) };
  }

  const ident = normalizeIdentifier(data.identifier);
  if (ident.kind === "unknown") {
    return { fieldErrors: { identifier: "Email o teléfono inválido" } };
  }

  const existing = await db.user.findUnique({
    where: { username: ident.value },
    select: { id: true },
  });
  if (existing) {
    return {
      fieldErrors: {
        identifier:
          "Ya existe una cuenta con este email/teléfono. Usá uno distinto.",
      },
    };
  }

  const passwordHash = await hashPassword(data.password);

  try {
    const created = await db.user.create({
      data: {
        username: ident.value,
        email: ident.kind === "email" ? ident.value : null,
        phone: ident.kind === "phone" ? ident.value : null,
        passwordHash,
        role: Role.CASHIER,
        fullName: data.name,
        storeId,
        isActive: true,
      },
      select: { id: true },
    });

    await audit({
      action: "saas.user_role_changed", // reusamos; metadata aclara invitación
      actorId,
      target: created.id,
      metadata: { invitedCashier: true, storeId },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        fieldErrors: {
          identifier: "Ya existe una cuenta con este email/teléfono.",
        },
      };
    }
    throw err;
  }

  revalidatePath("/dashboard/equipo");
  return { ok: true };
}

// ============== Suspender / reactivar ==============

const toggleSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["suspend", "reactivate"]),
});

export async function toggleCashierAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = toggleSchema.safeParse({
    userId: formData.get("userId"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  // Pertenencia: el cashier debe ser de la misma tienda que el caller.
  // Sin esto un owner podría tocar cashiers de otra tienda manipulando el
  // userId en el form.
  const target = await db.user.findFirst({
    where: { id: parsed.data.userId, storeId, role: Role.CASHIER },
    select: { id: true, fullName: true, isActive: true },
  });
  if (!target) {
    return { error: "Cajero no encontrado en tu tienda." };
  }

  const nextActive = parsed.data.action === "reactivate";
  if (target.isActive === nextActive) {
    // Ya está en el estado pedido — no-op, devuelve OK silencioso.
    return {};
  }

  await db.user.update({
    where: { id: target.id },
    data: { isActive: nextActive },
  });

  await audit({
    action: nextActive ? "saas.user_reactivated" : "saas.user_suspended",
    actorId,
    target: target.id,
    metadata: { storeId, role: "CASHIER" },
  });

  revalidatePath("/dashboard/equipo");
  return {};
}

// ============== Reset password (one-shot) ==============
// Pensado para cuando el cashier olvidó su contraseña y el owner se la
// resetea manualmente. NO genera magic link — la nueva password sale por
// pantalla, el owner se la comunica al cashier por canal seguro.

const resetSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

export type ResetCashierPasswordState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<"newPassword", string>>;
};

export async function resetCashierPasswordAction(
  _prev: ResetCashierPasswordState,
  formData: FormData,
): Promise<ResetCashierPasswordState> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = resetSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<ResetCashierPasswordState["fieldErrors"]>
      >(parsed.error),
    };
  }

  const target = await db.user.findFirst({
    where: { id: parsed.data.userId, storeId, role: Role.CASHIER },
    select: { id: true },
  });
  if (!target) return { error: "Cajero no encontrado en tu tienda." };

  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  await audit({
    action: "saas.user_password_reset_sent",
    actorId,
    target: target.id,
    metadata: { storeId, byOwner: true },
  });

  revalidatePath("/dashboard/equipo");
  return { ok: true };
}
