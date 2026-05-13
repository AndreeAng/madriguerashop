"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";

export type DeliveryZoneFormState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<
    Record<
      "name" | "fee" | "estimatedTime" | "centerLat" | "centerLng" | "radiusMeters",
      string
    >
  >;
};

// Helper para parsear los campos de geometría del form. Vienen como strings
// (siempre vía FormData). Si están vacíos, el círculo es opcional y el caller
// puede crear/actualizar zona sin shape (caso transición — zonas viejas que
// se editan antes de "dibujarlas").
function parseCircleFields(form: FormData):
  | { ok: true; shape: { lat: number; lng: number; radiusMeters: number } | null }
  | { ok: false; field: "centerLat" | "centerLng" | "radiusMeters"; message: string } {
  const latRaw = (form.get("centerLat") as string) ?? "";
  const lngRaw = (form.get("centerLng") as string) ?? "";
  const radRaw = (form.get("radiusMeters") as string) ?? "";

  // Los 3 vacíos = sin shape (válido, fallback al nombre/fee tradicional).
  if (!latRaw && !lngRaw && !radRaw) return { ok: true, shape: null };

  // Si vino al menos uno, exigimos los 3 — un radio sin centro o viceversa
  // queda inconsistente. Mostramos el primer faltante.
  if (!latRaw) return { ok: false, field: "centerLat", message: "Marcá el centro en el mapa." };
  if (!lngRaw) return { ok: false, field: "centerLng", message: "Marcá el centro en el mapa." };
  if (!radRaw) return { ok: false, field: "radiusMeters", message: "Definí el radio." };

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const radiusMeters = Number(radRaw);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90)
    return { ok: false, field: "centerLat", message: "Latitud inválida." };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    return { ok: false, field: "centerLng", message: "Longitud inválida." };
  if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 50_000)
    return {
      ok: false,
      field: "radiusMeters",
      message: "El radio debe estar entre 50 m y 50 km.",
    };

  return { ok: true, shape: { lat, lng, radiusMeters } };
}

const baseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  fee: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Tarifa inválida (ej. 10.00)")
    .transform((v) => Number(v))
    .refine((n) => n >= 0 && n <= 10_000, "Tarifa fuera de rango"),
  estimatedTime: z
    .string()
    .trim()
    .max(40, "Máximo 40 caracteres")
    .optional()
    .default(""),
  isActive: z.boolean().optional().default(true),
});

// ============== Crear / actualizar ==============

export async function upsertDeliveryZoneAction(
  _prev: DeliveryZoneFormState,
  formData: FormData,
): Promise<DeliveryZoneFormState> {
  const { storeId, userId } = await requireOwnerOnlyIds();

  const parsed = baseSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    fee: formData.get("fee"),
    estimatedTime: formData.get("estimatedTime") ?? "",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    const fe = zodIssuesToFieldErrors<
      keyof NonNullable<DeliveryZoneFormState["fieldErrors"]>
    >(parsed.error);
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  // Geometría: si el owner dibujó el círculo en el mapa, lo guardamos en
  // `polygon`. Sin dibujo (legacy) queda objeto vacío y la zona funciona
  // solo cuando el cliente la elige a mano en el select del checkout.
  const geometry = parseCircleFields(formData);
  if (!geometry.ok) {
    return { fieldErrors: { [geometry.field]: geometry.message } };
  }
  const polygonValue = geometry.shape
    ? {
        type: "circle" as const,
        lat: geometry.shape.lat,
        lng: geometry.shape.lng,
        radiusMeters: geometry.shape.radiusMeters,
      }
    : {};

  try {
    if (data.id) {
      // Update — chequeo de pertenencia incluido en el `where` (storeId).
      const updated = await db.deliveryZone.updateMany({
        where: { id: data.id, storeId },
        data: {
          name: data.name,
          fee: new Prisma.Decimal(data.fee),
          estimatedTime: data.estimatedTime || null,
          isActive: data.isActive,
          polygon: polygonValue,
        },
      });
      if (updated.count === 0) {
        return { error: "Zona no encontrada (o no pertenece a tu tienda)." };
      }
      await audit({
        action: "delivery_zone.updated",
        actorId: userId,
        target: data.id,
        metadata: { storeId, name: data.name },
      });
    } else {
      // Create — sortOrder por defecto al final.
      const lastSort = await db.deliveryZone.aggregate({
        where: { storeId },
        _max: { sortOrder: true },
      });
      const created = await db.deliveryZone.create({
        data: {
          storeId,
          name: data.name,
          fee: new Prisma.Decimal(data.fee),
          estimatedTime: data.estimatedTime || null,
          isActive: data.isActive,
          sortOrder: (lastSort._max.sortOrder ?? 0) + 1,
          // `polygon` = círculo si el owner lo dibujó, sino objeto vacío.
          // Sin dibujo, la zona solo funciona si el cliente la elige a mano
          // en el select del checkout (modo legacy).
          polygon: polygonValue,
        },
      });
      await audit({
        action: "delivery_zone.created",
        actorId: userId,
        target: created.id,
        metadata: { storeId, name: data.name },
      });
    }
  } catch (err) {
    console.error("[delivery-zones] upsert failed", err);
    return { error: "No pudimos guardar la zona. Probá de nuevo." };
  }

  revalidatePath("/dashboard/delivery");
  return { ok: true };
}

// ============== Borrar ==============

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteDeliveryZoneAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { storeId, userId } = await requireOwnerOnlyIds();

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Datos inválidos" };

  // Si la zona ya fue usada en pedidos, NO la borramos físicamente —
  // setear isActive=false preserva la integridad histórica. El admin
  // ve eso como "Inactiva" en la UI y puede crear una zona nueva.
  const zone = await db.deliveryZone.findFirst({
    where: { id: parsed.data.id, storeId },
    select: { id: true, name: true, _count: { select: { orders: true } } },
  });
  if (!zone) return { error: "Zona no encontrada" };

  if (zone._count.orders > 0) {
    await db.deliveryZone.update({
      where: { id: zone.id },
      data: { isActive: false },
    });
    await audit({
      action: "delivery_zone.deleted",
      actorId: userId,
      target: zone.id,
      metadata: {
        softDeleted: true,
        reason: "had orders",
        ordersCount: zone._count.orders,
        name: zone.name,
      },
    });
  } else {
    await db.deliveryZone.delete({ where: { id: zone.id } });
    await audit({
      action: "delivery_zone.deleted",
      actorId: userId,
      target: zone.id,
      metadata: { name: zone.name },
    });
  }

  revalidatePath("/dashboard/delivery");
  return {};
}
