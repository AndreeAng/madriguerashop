"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { INVALID_INPUT_ERROR } from "@/lib/validation/actionState";

export type BannerFormState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "title"
      | "subtitle"
      | "imageUrl"
      | "mobileImageUrl"
      | "linkUrl"
      | "validFrom"
      | "validTo",
      string
    >
  >;
};

// Validador de URL para IMÁGENES: acepta path relativo (`/`) o http(s)
// absoluto para soportar CDNs/imágenes externas legacy.
const imageUrlRel = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" || v.startsWith("/") || /^https?:\/\//.test(v),
    "URL inválida — usa una imagen subida o un enlace https://",
  );

// Validador para URLs de CLICK (link de banner, CTA de popup). Más estricto:
// solo path relativo o `https://` — rechaza `http://` para evitar que el
// owner mande clientes a un dominio en plano que un MITM puede manipular,
// y no permite `javascript:` ni `data:` por construcción.
const clickUrlRel = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || v.startsWith("/") || v.startsWith("https://"),
    "Usa https:// o una ruta relativa (/) — http no se permite por seguridad",
  );

const baseSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().max(80).optional().default(""),
    subtitle: z.string().trim().max(160).optional().default(""),
    imageUrl: imageUrlRel.refine((v) => v.length > 0, "La imagen es obligatoria"),
    mobileImageUrl: imageUrlRel.optional().default(""),
    linkUrl: clickUrlRel.optional().default(""),
    validFrom: z.string().optional().default(""),
    validTo: z.string().optional().default(""),
    isActive: z.boolean().optional().default(true),
  })
  // Si pone validFrom + validTo, validar orden cronológico.
  .superRefine((v, ctx) => {
    if (v.validFrom && v.validTo) {
      const f = new Date(v.validFrom);
      const t = new Date(v.validTo);
      if (
        Number.isFinite(f.getTime()) &&
        Number.isFinite(t.getTime()) &&
        f > t
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["validTo"],
          message: "La fecha fin debe ser posterior a la de inicio.",
        });
      }
    }
  });

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

// ============== Crear / actualizar ==============

export async function upsertBannerAction(
  _prev: BannerFormState,
  formData: FormData,
): Promise<BannerFormState> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = baseSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    title: formData.get("title") ?? "",
    subtitle: formData.get("subtitle") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    mobileImageUrl: formData.get("mobileImageUrl") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    validFrom: formData.get("validFrom") ?? "",
    validTo: formData.get("validTo") ?? "",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<BannerFormState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  const payload = {
    title: data.title || null,
    subtitle: data.subtitle || null,
    imageUrl: data.imageUrl,
    mobileImageUrl: data.mobileImageUrl || null,
    linkUrl: data.linkUrl || null,
    validFrom: parseDate(data.validFrom),
    validTo: parseDate(data.validTo),
    isActive: data.isActive,
  };

  try {
    if (data.id) {
      const updated = await db.banner.updateMany({
        where: { id: data.id, storeId },
        data: payload,
      });
      if (updated.count === 0) {
        return { error: "Banner no encontrado en tu tienda." };
      }
      await audit({
        action: "banner.updated",
        actorId,
        target: data.id,
        metadata: { storeId, title: data.title },
      });
    } else {
      const lastSort = await db.banner.aggregate({
        where: { storeId },
        _max: { sortOrder: true },
      });
      const created = await db.banner.create({
        data: {
          ...payload,
          storeId,
          position: "hero",
          sortOrder: (lastSort._max.sortOrder ?? 0) + 1,
        },
        select: { id: true },
      });
      await audit({
        action: "banner.created",
        actorId,
        target: created.id,
        metadata: { storeId, title: data.title },
      });
    }
  } catch (err) {
    console.error("[banners] upsert failed", err);
    return { error: "No pudimos guardar el banner. Prueba de nuevo." };
  }

  // Invalidación: el storefront cachea la página de la tienda; el tag
  // `store:<slug>` lo refresca para que el banner nuevo aparezca al
  // siguiente request. Sin esto, el owner crea un banner y no lo ve
  // hasta que la cache expira.
  revalidatePath("/dashboard/promociones");
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { slug: true },
  });
  if (store) {
    revalidatePath(`/${store.slug}`);
    revalidateTag(`store:${store.slug}`);
  }

  return { ok: true };
}

// ============== Borrar ==============

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteBannerAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  // Banner no tiene refs históricos (no se asocia a pedidos como
  // DeliveryZone), así que hard-delete es seguro.
  const deleted = await db.banner.deleteMany({
    where: { id: parsed.data.id, storeId },
  });
  if (deleted.count === 0) return { error: "Banner no encontrado" };

  await audit({
    action: "banner.deleted",
    actorId,
    target: parsed.data.id,
    metadata: { storeId },
  });

  revalidatePath("/dashboard/promociones");
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { slug: true },
  });
  if (store) {
    revalidatePath(`/${store.slug}`);
    revalidateTag(`store:${store.slug}`);
  }

  return {};
}
