"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, StoreVertical } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdminOrFail } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { INVALID_INPUT_ERROR, type ActionState } from "@/lib/validation/actionState";

const TEMPLATE_ERROR_MSG = "Sólo el super admin puede gestionar plantillas.";

// ============== Upsert ==============

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  // nativeEnum: acepta las 10 verticales del schema. Antes era un z.enum
  // manual con solo 5 — el admin no podía crear plantillas para BAKERY,
  // GROCERY, BEAUTY, HEALTH ni OTHER aunque el resto del sistema las soporta.
  vertical: z.nativeEnum(StoreVertical),
  description: z.string().trim().min(10).max(500),
  // `.url()` solo de Zod acepta cualquier scheme (http, https, ftp,
   // javascript:). El previewUrl se renderiza como `href` y como `src` de
   // iframes en `/admin/plantillas` — restringimos a http/https para evitar
   // XSS via `javascript:alert(1)` que un admin malintencionado o con
   // sesión comprometida podría inyectar.
  previewUrl: z
    .string()
    .trim()
    .url("URL de preview inválida")
    .refine(
      (v) => v.startsWith("https://") || v.startsWith("http://"),
      "Solo URLs http o https",
    ),
  componentKey: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/i, "Sólo a-z, 0-9 y _"),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0),
  isActive: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function upsertTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(TEMPLATE_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    vertical: formData.get("vertical"),
    description: formData.get("description"),
    previewUrl: formData.get("previewUrl"),
    componentKey: formData.get("componentKey"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<string>(parsed.error) };
  }
  const data = parsed.data;
  const isActive = data.isActive === "on";

  try {
    if (data.id) {
      const existing = await db.template.findUnique({
        where: { id: data.id },
        include: { _count: { select: { stores: true } } },
      });
      if (!existing) return { error: "Plantilla no encontrada." };

      // Bloquear cambio de componentKey si hay tiendas usando la plantilla:
      // el storefront mapea por componentKey al componente React. Cambiarlo
      // en producción rompe el render de todas las tiendas afectadas.
      if (
        existing._count.stores > 0 &&
        data.componentKey !== existing.componentKey
      ) {
        return {
          fieldErrors: {
            componentKey: `${existing._count.stores} tienda${existing._count.stores === 1 ? "" : "s"} usa esta plantilla. Reasignalas antes de cambiar el componentKey.`,
          },
        };
      }

      await db.template.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          vertical: data.vertical,
          description: data.description,
          previewUrl: data.previewUrl,
          componentKey: data.componentKey,
          sortOrder: data.sortOrder,
          isActive,
        },
      });

      await audit({
        action: "saas.template_updated",
        actorId: admin.id,
        actorRole: "SUPER_ADMIN",
        target: existing.id,
        metadata: { name: data.name, componentKey: data.componentKey },
      });
    } else {
      const created = await db.template.create({
        data: {
          name: data.name,
          vertical: data.vertical,
          description: data.description,
          previewUrl: data.previewUrl,
          componentKey: data.componentKey,
          sortOrder: data.sortOrder,
          isActive,
        },
      });

      await audit({
        action: "saas.template_created",
        actorId: admin.id,
        actorRole: "SUPER_ADMIN",
        target: created.id,
        metadata: { name: data.name, componentKey: data.componentKey },
      });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { componentKey: "Ya existe una plantilla con ese componentKey." } };
    }
    throw err;
  }

  revalidatePath("/admin/plantillas");
  return { ok: true };
}

// ============== Delete ==============

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(TEMPLATE_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  // Snapshot completo para el audit log — sin esto, después del delete
  // no hay forma de saber qué vertical/componentKey tenía la plantilla
  // borrada (forensics).
  const tpl = await db.template.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      name: true,
      vertical: true,
      isActive: true,
      componentKey: true,
    },
  });
  if (!tpl) return { error: "Plantilla no encontrada." };

  // Delete atómico: si hay tiendas usándola, deleteMany con `stores: { none }`
  // no afecta nada (count=0) y devolvemos error. Sin TOCTOU contra
  // reassignStoresToTemplateAction concurrente.
  const result = await db.template.deleteMany({
    where: { id: tpl.id, stores: { none: {} } },
  });
  if (result.count === 0) {
    return {
      error:
        "No se pudo eliminar: hay tiendas usando esta plantilla. Reasignalas primero.",
    };
  }

  await audit({
    action: "saas.template_deleted",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    target: tpl.id,
    metadata: {
      name: tpl.name,
      vertical: tpl.vertical,
      isActive: tpl.isActive,
      componentKey: tpl.componentKey,
    },
  });

  revalidatePath("/admin/plantillas");
  return { ok: true };
}

// ============== Reasignación masiva de tiendas ==============

const reassignSchema = z.object({
  fromTemplateId: z.string().min(1),
  toTemplateId: z.string().min(1),
});

export async function reassignStoresToTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireSuperAdminOrFail(TEMPLATE_ERROR_MSG);
  if ("error" in admin) return { error: admin.error };

  const parsed = reassignSchema.safeParse({
    fromTemplateId: formData.get("fromTemplateId"),
    toTemplateId: formData.get("toTemplateId"),
  });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };
  if (parsed.data.fromTemplateId === parsed.data.toTemplateId) {
    return { error: "Las plantillas son iguales — no hay nada que reasignar." };
  }

  const target = await db.template.findUnique({
    where: { id: parsed.data.toTemplateId },
    select: { id: true, isActive: true, name: true },
  });
  if (!target) return { error: "Plantilla destino no encontrada." };
  if (!target.isActive) {
    return { error: "La plantilla destino está inactiva. Activala primero." };
  }

  const result = await db.store.updateMany({
    where: { templateId: parsed.data.fromTemplateId },
    data: { templateId: target.id },
  });

  await audit({
    action: "saas.template_updated",
    actorId: admin.id,
    actorRole: "SUPER_ADMIN",
    target: parsed.data.toTemplateId,
    metadata: {
      reassignedCount: result.count,
      fromTemplateId: parsed.data.fromTemplateId,
    },
  });

  revalidatePath("/admin/plantillas");
  return { ok: true };
}
