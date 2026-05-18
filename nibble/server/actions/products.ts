"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { getStoreSlugById } from "@/lib/tenant/resolve";
import { slugify, validateSlug } from "@/lib/validation/slug";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { audit } from "@/lib/audit/log";
import type { ActionState } from "./store-settings";

// ============== Schemas ==============

const decimal = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Monto inválido (ej. 49.99)");

const decimalOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Monto inválido");

const upsertProductSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Nombre muy corto").max(120),
    slug: z.string().trim().optional(),
    description: z.string().trim().max(2000),
    shortDescription: z.string().trim().max(160),
    sku: z.string().trim().max(40),

    basePrice: decimal,
    comparePrice: decimalOrEmpty,

    manageStock: z.enum(["on", ""]).optional(),
    stock: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d+$/.test(v), "Stock debe ser un número entero"),
    lowStockAlert: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d+$/.test(v), "Alerta debe ser un número entero"),

    isActive: z.enum(["on", ""]).optional(),
    isFeatured: z.enum(["on", ""]).optional(),
    isNew: z.enum(["on", ""]).optional(),
    isBestSeller: z.enum(["on", ""]).optional(),
    customLabel: z.string().trim().max(40),

    categoryId: z.string().optional(),

    // Disponibilidad por horario
    hasSchedule: z.enum(["on", ""]).optional(),
    availableFrom: z.string().trim(),
    availableTo: z.string().trim(),
    availableDays: z.string().trim(), // CSV "0,1,2,..."

    // Reservas (servicios). El checkbox `isBookable` viene como "on"/null.
    isBookable: z.enum(["on", ""]).optional(),
    bookingDurationMin: z
      .string()
      .trim()
      .optional()
      .default("30")
      .transform((v) => {
        const n = parseInt(v || "30", 10);
        return Number.isFinite(n) && n >= 15 && n <= 480 ? n : 30;
      }),
    bookingBufferMin: z
      .string()
      .trim()
      .optional()
      .default("0")
      .transform((v) => {
        const n = parseInt(v || "0", 10);
        return Number.isFinite(n) && n >= 0 && n <= 120 ? n : 0;
      }),

    // Imágenes y variantes vienen como JSON serializado (gestionado por el cliente)
    imagesJson: z.string().default("[]"),
    variantsJson: z.string().default("[]"),
  })
  .refine(
    (v) => {
      if (v.comparePrice === "") return true;
      return Number(v.comparePrice) > Number(v.basePrice);
    },
    {
      message: "El precio de comparación debe ser mayor al precio base",
      path: ["comparePrice"],
    },
  );

type ProductField =
  | "name"
  | "slug"
  | "description"
  | "shortDescription"
  | "sku"
  | "basePrice"
  | "comparePrice"
  | "manageStock"
  | "stock"
  | "lowStockAlert"
  | "isActive"
  | "isFeatured"
  | "isNew"
  | "isBestSeller"
  | "customLabel"
  | "categoryId"
  | "imagesJson"
  | "variantsJson";

const imageItemSchema = z.object({
  url: z.string().min(1).max(2048),
  alt: z.string().max(160).optional(),
});

const variantItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  sku: z.string().trim().max(40).optional(),
  price: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Precio inválido")
    .optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  /** Toggle de stock por variante. Si true, `stock` debe ser ≥ 0. */
  manageStock: z.boolean().optional().default(false),
  stock: z
    .union([z.number().int().min(0).max(999_999), z.string()])
    .optional()
    .transform((v) => {
      if (typeof v === "number") return v;
      if (v === undefined || v === "") return 0;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }),
});

// ============== Helpers ==============

function invalidate(storeSlug: string) {
  revalidatePath(`/${storeSlug}`);
  revalidatePath(`/${storeSlug}/p`, "layout");
  revalidatePath("/dashboard/productos");
  revalidateTag(`store:${storeSlug}`);
}

// ============== Upsert ==============

export async function upsertProductAction(
  _prev: ActionState<ProductField>,
  formData: FormData,
): Promise<ActionState<ProductField>> {
  const { storeId, userId } = await requireOwnerOnlyIds();

  const raw = {
    id: (formData.get("id") as string) || undefined,
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    shortDescription: String(formData.get("shortDescription") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    basePrice: String(formData.get("basePrice") ?? ""),
    comparePrice: String(formData.get("comparePrice") ?? ""),
    manageStock: (formData.get("manageStock") ? "on" : "") as "on" | "",
    stock: String(formData.get("stock") ?? ""),
    lowStockAlert: String(formData.get("lowStockAlert") ?? ""),
    isActive: (formData.get("isActive") ? "on" : "") as "on" | "",
    isFeatured: (formData.get("isFeatured") ? "on" : "") as "on" | "",
    isNew: (formData.get("isNew") ? "on" : "") as "on" | "",
    isBestSeller: (formData.get("isBestSeller") ? "on" : "") as "on" | "",
    customLabel: String(formData.get("customLabel") ?? ""),
    categoryId: (formData.get("categoryId") as string) || "",
    hasSchedule: (formData.get("hasSchedule") ? "on" : "") as "on" | "",
    isBookable: (formData.get("isBookable") ? "on" : "") as "on" | "",
    bookingDurationMin: String(formData.get("bookingDurationMin") ?? "30"),
    bookingBufferMin: String(formData.get("bookingBufferMin") ?? "0"),
    availableFrom: String(formData.get("availableFrom") ?? ""),
    availableTo: String(formData.get("availableTo") ?? ""),
    availableDays: String(formData.get("availableDays") ?? ""),
    imagesJson: (formData.get("imagesJson") as string) || "[]",
    variantsJson: (formData.get("variantsJson") as string) || "[]",
  };

  const parsed = upsertProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<ProductField>(parsed.error) };
  }
  const data = parsed.data;

  // Plan limits: solo aplica al CREATE (un edit no aumenta el conteo).
  // Si el plan tope alcanzó, devolvemos error global con guía al owner
  // para suspender otro producto o subir de plan.
  if (!data.id) {
    const { checkProductLimit, productLimitMessage } = await import(
      "@/lib/billing/plan-limits"
    );
    const limit = await checkProductLimit(storeId);
    if (limit.exceeded) {
      return { error: productLimitMessage(limit) };
    }
  }

  // Slug
  const candidate = data.slug && data.slug.length > 0 ? slugify(data.slug) : slugify(data.name);
  const slugCheck = validateSlug(candidate);
  if (!slugCheck.ok) {
    return {
      fieldErrors: {
        slug:
          slugCheck.reason === "reserved"
            ? "Slug reservado. Prueba otro."
            : "Slug inválido.",
      },
    };
  }
  const slug = slugCheck.value;

  // Category pertenece a esta tienda
  if (data.categoryId) {
    const cat = await db.category.findFirst({
      where: { id: data.categoryId, storeId },
      select: { id: true },
    });
    if (!cat) return { fieldErrors: { categoryId: "Categoría no encontrada" } };
  }

  // Parse imágenes y variantes
  let images: { url: string; alt?: string }[];
  try {
    images = imageItemSchema.array().parse(JSON.parse(data.imagesJson));
  } catch {
    return { fieldErrors: { imagesJson: "Formato de imágenes inválido" } };
  }

  let variants: z.infer<typeof variantItemSchema>[];
  try {
    variants = variantItemSchema.array().parse(JSON.parse(data.variantsJson));
  } catch {
    return { fieldErrors: { variantsJson: "Formato de variantes inválido" } };
  }

  // Schedule: parsear días desde CSV
  const scheduleEnabled = data.hasSchedule === "on";
  const days = data.availableDays
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  // Construir payload Prisma
  const productData = {
    storeId,
    name: data.name,
    slug,
    description: data.description || null,
    shortDescription: data.shortDescription || null,
    sku: data.sku || null,
    basePrice: new Prisma.Decimal(data.basePrice),
    comparePrice: data.comparePrice ? new Prisma.Decimal(data.comparePrice) : null,
    manageStock: data.manageStock === "on",
    stock: data.stock === "" ? 0 : Number(data.stock),
    lowStockAlert: data.lowStockAlert === "" ? null : Number(data.lowStockAlert),
    isActive: data.isActive === "on",
    isFeatured: data.isFeatured === "on",
    isNew: data.isNew === "on",
    isBestSeller: data.isBestSeller === "on",
    customLabel: data.customLabel || null,
    categoryId: data.categoryId || null,
    hasSchedule: scheduleEnabled,
    availableFrom: scheduleEnabled && data.availableFrom ? data.availableFrom : null,
    availableTo: scheduleEnabled && data.availableTo ? data.availableTo : null,
    availableDays: scheduleEnabled ? days : [],
    isBookable: data.isBookable === "on",
    bookingDurationMin: data.bookingDurationMin,
    bookingBufferMin: data.bookingBufferMin,
  };

  try {
    if (data.id) {
      // UPDATE — verifica ownership
      const existing = await db.product.findFirst({
        where: { id: data.id, storeId },
        select: { id: true },
      });
      if (!existing) return { error: "Producto no encontrado" };

      await db.$transaction(async (tx) => {
        await tx.product.update({ where: { id: data.id! }, data: productData });
        // Reemplazar imágenes (no hay referencias externas — delete+create
        // es seguro).
        await tx.productImage.deleteMany({ where: { productId: data.id! } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img, i) => ({
              productId: data.id!,
              url: img.url,
              alt: img.alt || null,
              sortOrder: i,
            })),
          });
        }

        // Variantes: upsert por id en vez de full-replace. Las variantes
        // pueden estar referenciadas por CartItem (carritos vivos del
        // cliente) y OrderItem (histórico). Borrar+recrear:
        //   - Para CartItem (`onDelete: SetNull`): la variante queda en
        //     NULL silenciosamente y el carrito muestra el ítem sin la
        //     elección original — el cliente paga por algo distinto a lo
        //     que eligió. `buildSnapshot` detecta esto via el flag
        //     `items_removed` y descarta + notifica.
        //   - Para OrderItem (`onDelete: SetNull`): se pierde el ID
        //     histórico de la variante, aunque `variantName` queda en el
        //     OrderItem como snapshot.
        // Con upsert preservamos los IDs que el owner no tocó y borramos
        // solo las que efectivamente quitó del formulario.
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: data.id! },
          select: { id: true },
        });
        const existingIds = new Set(existingVariants.map((v) => v.id));
        const submittedIds = new Set(
          variants.map((v) => v.id).filter((id): id is string => Boolean(id)),
        );
        const idsToDelete = [...existingIds].filter(
          (id) => !submittedIds.has(id),
        );

        if (idsToDelete.length > 0) {
          // Borrar primero los CartItem vivos que referenciaban esas
          // variantes — así el cliente verá el cart "purgado" (con el
          // notice "items_removed") en lugar de la línea con variantId
          // colgando en NULL. OrderItem queda con `variantId: NULL` pero
          // mantiene `variantName` como snapshot histórico.
          await tx.cartItem.deleteMany({
            where: { variantId: { in: idsToDelete } },
          });
          await tx.productVariant.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }

        // Upsert por orden. Cada variante con `id` se actualiza por ese
        // id (validamos que pertenezca al producto para que un payload
        // malicioso no toque variantes de OTROS productos).
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i]!;
          const variantData = {
            name: v.name,
            sku: v.sku || null,
            price: v.price ? new Prisma.Decimal(v.price) : null,
            attributes: v.attributes ?? {},
            sortOrder: i,
            isActive: true,
            manageStock: v.manageStock,
            stock: v.manageStock ? v.stock : 0,
          };
          if (v.id && existingIds.has(v.id)) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: variantData,
            });
          } else {
            await tx.productVariant.create({
              data: { productId: data.id!, ...variantData },
            });
          }
        }
      });
    } else {
      // CREATE
      await db.product.create({
        data: {
          ...productData,
          images:
            images.length > 0
              ? {
                  create: images.map((img, i) => ({
                    url: img.url,
                    alt: img.alt || null,
                    sortOrder: i,
                  })),
                }
              : undefined,
          variants:
            variants.length > 0
              ? {
                  create: variants.map((v, i) => ({
                    name: v.name,
                    sku: v.sku || null,
                    price: v.price ? new Prisma.Decimal(v.price) : null,
                    attributes: v.attributes ?? {},
                    sortOrder: i,
                    isActive: true,
                    manageStock: v.manageStock,
                    stock: v.manageStock ? v.stock : 0,
                  })),
                }
              : undefined,
        },
      });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { slug: "Ya existe un producto con ese slug." } };
    }
    throw err;
  }

  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: data.id ? "product.updated" : "product.created",
    actorId: userId,
    storeId,
    target: data.id ?? null,
    metadata: { name: data.name, slug: data.slug },
  });
  return { ok: true };
}

// ============== Delete ==============

export async function deleteProductAction(formData: FormData): Promise<ActionState> {
  const { storeId, userId } = await requireOwnerOnlyIds();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ID requerido" };

  const existing = await db.product.findFirst({
    where: { id, storeId },
    select: { id: true, name: true, slug: true },
  });
  if (!existing) return { error: "Producto no encontrado" };

  // CartItems / OrderItems no tienen onDelete:Cascade en el schema vs Product
  // (sólo Variant lo tiene). Por seguridad: si está en algún pedido, no permitimos
  // delete físico — el owner debería desactivar.
  const inOrder = await db.orderItem.count({ where: { productId: id } });
  if (inOrder > 0) {
    return {
      error:
        "Este producto está en pedidos pasados. Mejor desactivalo (toggle 'Activo') en lugar de eliminarlo.",
    };
  }

  await db.product.delete({ where: { id } });
  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: "product.deleted",
    actorId: userId,
    storeId,
    target: id,
    metadata: { name: existing.name, slug: existing.slug },
  });
  return { ok: true };
}

// ============== Toggle isActive ==============

export async function toggleProductActiveAction(formData: FormData): Promise<ActionState> {
  const { storeId, userId } = await requireOwnerOnlyIds();
  const id = String(formData.get("id") ?? "");

  // Read-then-write atómico: leemos el estado real de DB en lugar de confiar
  // en el valor del form (que puede estar stale si otro tab lo cambió).
  const existing = await db.product.findFirst({
    where: { id, storeId },
    select: { id: true, isActive: true },
  });
  if (!existing) return { error: "Producto no encontrado" };

  await db.product.update({
    where: { id: existing.id },
    data: { isActive: !existing.isActive },
  });
  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: "product.toggled_active",
    actorId: userId,
    storeId,
    target: existing.id,
    metadata: { isActive: !existing.isActive },
  });
  return { ok: true };
}
