"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, CouponType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { INVALID_INPUT_ERROR } from "@/lib/validation/actionState";
import { captureError } from "@/lib/observability/captureError";

export type CouponFormState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "code"
      | "description"
      | "type"
      | "value"
      | "minOrderAmount"
      | "maxDiscountAmount"
      | "usageLimit"
      | "usageLimitPerUser"
      | "validFrom"
      | "validTo",
      string
    >
  >;
};

// Validador de "Decimal positivo en string". Vacío → null.
const decimalNullable = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine(
    (v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v),
    "Importe inválido (ej. 10.50)",
  )
  .transform((v) => (v === "" ? null : Number(v)));

const intNullable = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => v === "" || /^\d+$/.test(v), "Sólo números enteros")
  .transform((v) => (v === "" ? null : Number(v)));

const baseSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(30, "Máximo 30 caracteres")
      .regex(/^[A-Z0-9_-]+$/, "Sólo MAYÚSCULAS, números, guión y guión bajo"),
    description: z.string().trim().max(160).optional().default(""),
    type: z.nativeEnum(CouponType, { message: "Elige un tipo de cupón" }),
    value: z
      .string()
      .trim()
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Valor inválido")
      .transform((v) => Number(v))
      .refine((n) => n > 0, "El valor debe ser mayor a 0"),
    minOrderAmount: decimalNullable,
    maxDiscountAmount: decimalNullable,
    usageLimit: intNullable,
    usageLimitPerUser: intNullable,
    validFrom: z.string().min(1, "Fecha de inicio requerida"),
    validTo: z.string().min(1, "Fecha de fin requerida"),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((v, ctx) => {
    // Ventana cronológica.
    const f = new Date(v.validFrom);
    const t = new Date(v.validTo);
    if (Number.isFinite(f.getTime()) && Number.isFinite(t.getTime()) && f >= t) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "La fecha fin debe ser posterior al inicio.",
      });
    }
    // PERCENTAGE: el valor representa %, debe ser ≤ 100.
    if (v.type === "PERCENTAGE" && v.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "El porcentaje no puede superar 100.",
      });
    }
    // FREE_SHIPPING: el `value` no se usa para calcular descuento (cubre
    // el envío), pero el schema lo exige > 0. Como atajo dejamos pasar
    // cualquier valor y lo seteamos a 0 al guardar abajo.
  });

// ============== Crear / actualizar ==============

export async function upsertCouponAction(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = baseSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    code: String(formData.get("code") ?? "").toUpperCase(),
    description: formData.get("description") ?? "",
    type: formData.get("type"),
    value: formData.get("value") ?? "0",
    minOrderAmount: formData.get("minOrderAmount") ?? "",
    maxDiscountAmount: formData.get("maxDiscountAmount") ?? "",
    usageLimit: formData.get("usageLimit") ?? "",
    usageLimitPerUser: formData.get("usageLimitPerUser") ?? "",
    validFrom: formData.get("validFrom") ?? "",
    validTo: formData.get("validTo") ?? "",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<CouponFormState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  const payload = {
    code: data.code,
    description: data.description || null,
    type: data.type,
    // FREE_SHIPPING ignora `value` en el cálculo del descuento (lo aplica
    // sobre el envío). Lo guardamos en 0 para no exponer un número ruidoso.
    value: new Prisma.Decimal(data.type === "FREE_SHIPPING" ? 0 : data.value),
    minOrderAmount:
      data.minOrderAmount !== null
        ? new Prisma.Decimal(data.minOrderAmount)
        : null,
    maxDiscountAmount:
      data.maxDiscountAmount !== null
        ? new Prisma.Decimal(data.maxDiscountAmount)
        : null,
    usageLimit: data.usageLimit,
    usageLimitPerUser: data.usageLimitPerUser,
    validFrom: new Date(data.validFrom),
    validTo: new Date(data.validTo),
    isActive: data.isActive,
  };

  try {
    if (data.id) {
      // Pre-fetch: estado anterior para el delta del audit log y para
      // distinguir "no encontrado" de "límite violado" en el path de error.
      const before = await db.coupon.findFirst({
        where: { id: data.id, storeId },
        select: { code: true, type: true, value: true, validFrom: true, validTo: true, usageLimit: true, isActive: true, usedCount: true },
      });
      if (!before) return { error: "Cupón no encontrado." };

      // Test-and-set atómico: el WHERE incluye la condición de negocio para
      // evitar la ventana TOCTOU de un "read → validate → write" separado.
      const updated = await db.coupon.updateMany({
        where: {
          id: data.id,
          storeId,
          ...(data.usageLimit !== null ? { usedCount: { lte: data.usageLimit } } : {}),
        },
        data: payload,
      });
      if (updated.count === 0) {
        return {
          fieldErrors: {
            usageLimit: `Este cupón ya tiene ${before.usedCount} usos. El tope no puede ser menor a ese número.`,
          },
        };
      }
      await audit({
        action: "coupon.updated",
        actorId,
        target: data.id,
        metadata: {
          storeId,
          code: data.code,
          before: { type: before.type, value: before.value.toString(), validFrom: before.validFrom, validTo: before.validTo, usageLimit: before.usageLimit, isActive: before.isActive },
          after: { type: data.type, value: data.value, validFrom: data.validFrom, validTo: data.validTo, usageLimit: data.usageLimit, isActive: data.isActive },
        },
      });
    } else {
      const created = await db.coupon.create({
        data: { ...payload, storeId },
        select: { id: true },
      });
      await audit({
        action: "coupon.created",
        actorId,
        target: created.id,
        metadata: { storeId, code: data.code },
      });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Unique constraint (storeId, code) — el código ya existe en esta tienda.
      return {
        fieldErrors: {
          code: "Ya tienes un cupón con este código en tu tienda.",
        },
      };
    }
    captureError(err, { action: "coupons.upsert", storeId });
    return { error: "No pudimos guardar el cupón." };
  }

  revalidatePath("/dashboard/promociones");
  return { ok: true };
}

// ============== Borrar ==============

export async function deleteCouponAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: INVALID_INPUT_ERROR };

  // Cupón con usos: soft-delete (isActive=false) para preservar el
  // historial de pedidos que lo aplicaron. Sin esto, un pedido con cupón
  // borrado mostraría "(cupón eliminado)" — peor UX que un cupón inactivo.
  const coupon = await db.coupon.findFirst({
    where: { id, storeId },
    select: { id: true, code: true, _count: { select: { orders: true } } },
  });
  if (!coupon) return { error: "Cupón no encontrado" };

  if (coupon._count.orders > 0) {
    await db.coupon.update({
      where: { id: coupon.id },
      data: { isActive: false },
    });
    await audit({
      action: "coupon.deleted",
      actorId,
      target: coupon.id,
      metadata: {
        softDeleted: true,
        reason: "had orders",
        ordersCount: coupon._count.orders,
        code: coupon.code,
      },
    });
  } else {
    await db.coupon.delete({ where: { id: coupon.id, storeId } });
    await audit({
      action: "coupon.deleted",
      actorId,
      target: coupon.id,
      metadata: { code: coupon.code },
    });
  }

  revalidatePath("/dashboard/promociones");
  return {};
}
