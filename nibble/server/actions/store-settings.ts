"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { getStoreSlugById } from "@/lib/tenant/resolve";
import { normalizePhoneBO, PHONE_BO_RE } from "@/lib/auth/identifiers";

// ============== Tipos comunes ==============

export type ActionState<F extends string = string> = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<F, string>>;
};

// ============== Helpers ==============

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const URL_OR_EMPTY = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "Tiene que ser una URL válida (http/https)");

const PHONE_BO = z
  .string()
  .trim()
  .refine((v) => {
    const stripped = v.replace(/[\s-]/g, "");
    return PHONE_BO_RE.test(stripped);
  }, "Teléfono inválido. Formato: +591XXXXXXXX");

const normalizePhone = normalizePhoneBO;

/** Convierte FormData en objeto plano leyendo sólo las claves dadas. */
function readForm<K extends string>(fd: FormData, keys: K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = String(fd.get(k) ?? "");
  return out;
}

function fieldErrorsFromZod<F extends string>(err: z.ZodError): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const issue of err.issues) {
    const key = issue.path[0] as F | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Invalida cachés que dependen de la store. */
function invalidateStore(storeSlug: string) {
  revalidatePath(`/${storeSlug}`);
  revalidatePath("/dashboard/settings");
  revalidateTag(`store:${storeSlug}`);
}

// ============== 1. Identidad + Marca + Contacto ==============

const identityFields = [
  "name",
  "description",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "fontFamily",
  "logoUrl",
  "bannerUrl",
  "faviconUrl",
  "whatsappPhone",
  "email",
  "addressText",
  "city",
  "instagram",
  "facebook",
  "tiktok",
  "website",
] as const;
type IdentityField = (typeof identityFields)[number];

const identitySchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(60),
  description: z.string().trim().max(500).optional().nullable(),

  primaryColor: z.string().regex(HEX_COLOR, "Color hex inválido (ej. #dc2626)"),
  secondaryColor: z.string().regex(HEX_COLOR, "Color hex inválido"),
  accentColor: z.string().regex(HEX_COLOR, "Color hex inválido"),
  fontFamily: z.string().trim().min(1).max(60),

  logoUrl: URL_OR_EMPTY,
  bannerUrl: URL_OR_EMPTY,
  faviconUrl: URL_OR_EMPTY,

  whatsappPhone: PHONE_BO,
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  addressText: z.string().trim().max(200),
  city: z.string().trim().min(2, "Ingresa tu ciudad").max(60),

  instagram: z.string().trim().max(60),
  facebook: z.string().trim().max(60),
  tiktok: z.string().trim().max(60),
  website: URL_OR_EMPTY,
});

export async function updateIdentityAction(
  _prev: ActionState<IdentityField>,
  formData: FormData,
): Promise<ActionState<IdentityField>> {
  const { storeId } = await requireOwnerOnlyIds();
  const raw = readForm(formData, [...identityFields]);

  const parsed = identitySchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<IdentityField>(parsed.error) };
  }

  const data = parsed.data;
  const store = await db.store.update({
    where: { id: storeId },
    data: {
      name: data.name,
      description: data.description || null,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
      fontFamily: data.fontFamily,
      logoUrl: data.logoUrl || null,
      bannerUrl: data.bannerUrl || null,
      faviconUrl: data.faviconUrl || null,
      whatsappPhone: normalizePhone(data.whatsappPhone),
      email: data.email || null,
      addressText: data.addressText || null,
      city: data.city,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      tiktok: data.tiktok || null,
      website: data.website || null,
    },
    select: { slug: true },
  });

  invalidateStore(store.slug);
  return { ok: true };
}

// ============== 2. Pagos ==============

type PaymentsField =
  | "qrImageUrl"
  | "qrInstructions"
  | "acceptsCashOnDelivery"
  | "acceptsQR";

const paymentsSchema = z
  .object({
    qrImageUrl: URL_OR_EMPTY,
    qrInstructions: z.string().trim().max(1000),
    acceptsCashOnDelivery: z.enum(["on", ""]).optional(),
    acceptsQR: z.enum(["on", ""]).optional(),
  })
  .refine(
    (v) => v.acceptsCashOnDelivery === "on" || v.acceptsQR === "on",
    {
      message: "Tienes que aceptar al menos un método de pago",
      path: ["acceptsCashOnDelivery"],
    },
  )
  .refine((v) => v.acceptsQR !== "on" || v.qrImageUrl.length > 0, {
    message: "Si aceptas QR, sube o pega la URL de tu QR",
    path: ["qrImageUrl"],
  });

export async function updatePaymentsAction(
  _prev: ActionState<PaymentsField>,
  formData: FormData,
): Promise<ActionState<PaymentsField>> {
  const { storeId } = await requireOwnerOnlyIds();
  const raw = {
    qrImageUrl: String(formData.get("qrImageUrl") ?? ""),
    qrInstructions: String(formData.get("qrInstructions") ?? ""),
    acceptsCashOnDelivery: (formData.get("acceptsCashOnDelivery") ? "on" : "") as "on" | "",
    acceptsQR: (formData.get("acceptsQR") ? "on" : "") as "on" | "",
  };

  const parsed = paymentsSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<PaymentsField>(parsed.error) };
  }

  const store = await db.store.update({
    where: { id: storeId },
    data: {
      qrImageUrl: parsed.data.qrImageUrl || null,
      qrInstructions: parsed.data.qrInstructions || null,
      acceptsCashOnDelivery: parsed.data.acceptsCashOnDelivery === "on",
      acceptsQR: parsed.data.acceptsQR === "on",
    },
    select: { slug: true },
  });

  invalidateStore(store.slug);
  return { ok: true };
}

// ============== 3. Delivery ==============

type DeliveryField =
  | "deliveryEnabled"
  | "pickupEnabled"
  | "defaultDeliveryFee"
  | "freeDeliveryAbove"
  | "deliveryNote";

const moneySchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Monto inválido");

const deliverySchema = z
  .object({
    deliveryEnabled: z.enum(["on", ""]).optional(),
    pickupEnabled: z.enum(["on", ""]).optional(),
    defaultDeliveryFee: moneySchema,
    freeDeliveryAbove: moneySchema,
    deliveryNote: z.string().trim().max(200),
  })
  .refine((v) => v.deliveryEnabled === "on" || v.pickupEnabled === "on", {
    message: "Tienes que ofrecer al menos delivery o recojo en local",
    path: ["deliveryEnabled"],
  });

export async function updateDeliveryAction(
  _prev: ActionState<DeliveryField>,
  formData: FormData,
): Promise<ActionState<DeliveryField>> {
  const { storeId } = await requireOwnerOnlyIds();
  const raw = {
    deliveryEnabled: (formData.get("deliveryEnabled") ? "on" : "") as "on" | "",
    pickupEnabled: (formData.get("pickupEnabled") ? "on" : "") as "on" | "",
    defaultDeliveryFee: String(formData.get("defaultDeliveryFee") ?? ""),
    freeDeliveryAbove: String(formData.get("freeDeliveryAbove") ?? ""),
    deliveryNote: String(formData.get("deliveryNote") ?? ""),
  };

  const parsed = deliverySchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<DeliveryField>(parsed.error) };
  }

  const store = await db.store.update({
    where: { id: storeId },
    data: {
      deliveryEnabled: parsed.data.deliveryEnabled === "on",
      pickupEnabled: parsed.data.pickupEnabled === "on",
      defaultDeliveryFee:
        parsed.data.defaultDeliveryFee === ""
          ? null
          : new Prisma.Decimal(parsed.data.defaultDeliveryFee),
      freeDeliveryAbove:
        parsed.data.freeDeliveryAbove === ""
          ? null
          : new Prisma.Decimal(parsed.data.freeDeliveryAbove),
      deliveryNote: parsed.data.deliveryNote || null,
    },
    select: { slug: true },
  });

  invalidateStore(store.slug);
  return { ok: true };
}

// ============== 4. Horarios ==============

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
type HoursField = `day_${number}_open` | `day_${number}_close` | `day_${number}_closed`;

const dayHoursSchema = z
  .object({
    isClosed: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  })
  // Cada refine pone el `path` apropiado para que el error se asigne al
  // campo correcto (antes el mensaje "horario inválido" caía siempre en
  // `_open` aunque viniera de `_close`).
  .refine((v) => v.isClosed || TIME_RE.test(v.openTime), {
    message: "Horario de apertura inválido (HH:MM)",
    path: ["openTime"],
  })
  .refine((v) => v.isClosed || TIME_RE.test(v.closeTime), {
    message: "Horario de cierre inválido (HH:MM)",
    path: ["closeTime"],
  })
  .refine((v) => v.isClosed || v.openTime < v.closeTime, {
    message: "El cierre tiene que ser después de la apertura",
    path: ["closeTime"],
  });

export async function updateHoursAction(
  _prev: ActionState<HoursField>,
  formData: FormData,
): Promise<ActionState<HoursField>> {
  const { storeId } = await requireOwnerOnlyIds();

  const fieldErrors: Partial<Record<HoursField, string>> = {};
  const validated: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[] = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const isClosed = formData.get(`day_${dayOfWeek}_closed`) === "on";
    const openTime = String(formData.get(`day_${dayOfWeek}_open`) ?? "");
    const closeTime = String(formData.get(`day_${dayOfWeek}_close`) ?? "");
    const parsed = dayHoursSchema.safeParse({ isClosed, openTime, closeTime });
    if (!parsed.success) {
      // Cada issue tiene `path: ["openTime"|"closeTime"]` — lo mapeamos
      // al field name del form (`day_X_open`/`day_X_close`).
      for (const issue of parsed.error.issues) {
        const which = issue.path[0] === "closeTime" ? "close" : "open";
        const key = `day_${dayOfWeek}_${which}` as HoursField;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      continue;
    }
    validated.push({
      dayOfWeek,
      openTime: parsed.data.isClosed ? "00:00" : parsed.data.openTime,
      closeTime: parsed.data.isClosed ? "00:00" : parsed.data.closeTime,
      isClosed: parsed.data.isClosed,
    });
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Upsert los 7 días en una transacción
  await db.$transaction(
    validated.map((d) =>
      db.storeHours.upsert({
        where: { storeId_dayOfWeek: { storeId, dayOfWeek: d.dayOfWeek } },
        create: { storeId, ...d },
        update: { openTime: d.openTime, closeTime: d.closeTime, isClosed: d.isClosed },
      }),
    ),
  );

  const storeSlug = await getStoreSlugById(storeId);
  if (storeSlug) invalidateStore(storeSlug);
  return { ok: true };
}

// ============== 5. SEO ==============

const seoFields = ["metaTitle", "metaDescription", "metaKeywords", "ogImageUrl"] as const;
type SeoField = (typeof seoFields)[number];

const seoSchema = z.object({
  metaTitle: z.string().trim().max(70),
  metaDescription: z.string().trim().max(160),
  metaKeywords: z.string().trim().max(200),
  ogImageUrl: URL_OR_EMPTY,
});

export async function updateSeoAction(
  _prev: ActionState<SeoField>,
  formData: FormData,
): Promise<ActionState<SeoField>> {
  const { storeId } = await requireOwnerOnlyIds();
  const raw = readForm(formData, [...seoFields]);

  const parsed = seoSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod<SeoField>(parsed.error) };
  }

  const store = await db.store.update({
    where: { id: storeId },
    data: {
      metaTitle: parsed.data.metaTitle || null,
      metaDescription: parsed.data.metaDescription || null,
      metaKeywords: parsed.data.metaKeywords || null,
      ogImageUrl: parsed.data.ogImageUrl || null,
    },
    select: { slug: true },
  });

  invalidateStore(store.slug);
  return { ok: true };
}
