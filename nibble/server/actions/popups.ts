"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { INVALID_INPUT_ERROR } from "@/lib/validation/actionState";

export type PopupFormState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "title"
      | "message"
      | "imageUrl"
      | "ctaText"
      | "ctaUrl"
      | "delaySeconds"
      | "validFrom"
      | "validTo",
      string
    >
  >;
};

// `imageUrl` acepta http(s) absoluto (CDN externa) o ruta relativa.
const imageUrlRel = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v),
    "URL inválida",
  );

// `ctaUrl` es destino de click: solo https o relativo, sin http plano,
// sin javascript:, sin data:. Bloquear http evita que el owner mande al
// cliente a un sitio MITM-eable desde su popup.
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
    title: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
    message: z.string().trim().min(2, "Mínimo 2 caracteres").max(500),
    imageUrl: imageUrlRel.optional().default(""),
    ctaText: z.string().trim().max(40).optional().default(""),
    ctaUrl: clickUrlRel.optional().default(""),
    delaySeconds: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v), "Sólo números")
      .transform((v) => Number(v))
      .refine((n) => n >= 0 && n <= 60, "Entre 0 y 60 segundos"),
    showOncePerSession: z.boolean().optional().default(true),
    validFrom: z.string().optional().default(""),
    validTo: z.string().optional().default(""),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.validFrom && v.validTo) {
      const f = new Date(v.validFrom);
      const t = new Date(v.validTo);
      if (Number.isFinite(f.getTime()) && Number.isFinite(t.getTime()) && f > t) {
        ctx.addIssue({
          code: "custom",
          path: ["validTo"],
          message: "La fecha fin debe ser posterior a la de inicio.",
        });
      }
    }
    // CTA: si hay texto exigimos URL y viceversa (uno solo confunde al cliente).
    if (v.ctaText && !v.ctaUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["ctaUrl"],
        message: "Si pusiste texto en el botón, agrega adónde lleva.",
      });
    }
    if (v.ctaUrl && !v.ctaText) {
      ctx.addIssue({
        code: "custom",
        path: ["ctaText"],
        message: "Si pusiste link, dale un texto al botón.",
      });
    }
  });

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

// ============== Crear / actualizar ==============

export async function upsertPopupAction(
  _prev: PopupFormState,
  formData: FormData,
): Promise<PopupFormState> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();

  const parsed = baseSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    title: formData.get("title"),
    message: formData.get("message"),
    imageUrl: formData.get("imageUrl") ?? "",
    ctaText: formData.get("ctaText") ?? "",
    ctaUrl: formData.get("ctaUrl") ?? "",
    delaySeconds: formData.get("delaySeconds") ?? "3",
    showOncePerSession: formData.get("showOncePerSession") === "on",
    validFrom: formData.get("validFrom") ?? "",
    validTo: formData.get("validTo") ?? "",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<PopupFormState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  const payload = {
    title: data.title,
    message: data.message,
    imageUrl: data.imageUrl || null,
    ctaText: data.ctaText || null,
    ctaUrl: data.ctaUrl || null,
    delaySeconds: data.delaySeconds,
    showOncePerSession: data.showOncePerSession,
    validFrom: parseDate(data.validFrom),
    validTo: parseDate(data.validTo),
    isActive: data.isActive,
  };

  try {
    if (data.id) {
      const updated = await db.popup.updateMany({
        where: { id: data.id, storeId },
        data: payload,
      });
      if (updated.count === 0) return { error: "Popup no encontrado." };
      await audit({
        action: "popup.updated",
        actorId,
        target: data.id,
        metadata: { storeId, title: data.title },
      });
    } else {
      const created = await db.popup.create({
        data: { ...payload, storeId },
        select: { id: true },
      });
      await audit({
        action: "popup.created",
        actorId,
        target: created.id,
        metadata: { storeId, title: data.title },
      });
    }
  } catch (err) {
    console.error("[popups] upsert failed", err);
    return { error: "No pudimos guardar el popup." };
  }

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

export async function deletePopupAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId: actorId } = await requireOwnerOnlyIds();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: INVALID_INPUT_ERROR };

  const deleted = await db.popup.deleteMany({ where: { id, storeId } });
  if (deleted.count === 0) return { error: "Popup no encontrado" };

  await audit({
    action: "popup.deleted",
    actorId,
    target: id,
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
