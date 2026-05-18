import "server-only";
import { Prisma, Role, StoreStatus, BillingCycle, StoreVertical } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizeIdentifier, normalizePhoneBO } from "@/lib/auth/identifiers";
import { slugify, validateSlug } from "@/lib/validation/slug";
import { saveImage, type ImageKind } from "@/lib/storage/upload";
import { audit } from "@/lib/audit/log";
import {
  fetchQuickCatalog,
  fetchQuickStoreData,
  fetchCategoryProducts,
  fetchImageBuffer,
  bufferToFile,
  type QuickProduct,
} from "./client";

/**
 * Importa una tienda completa de cat.quick.com.bo a Madriguera.
 *
 * Pasos:
 *   1. Fetch store-data (branding) + catalog (categorías + productos)
 *   2. Crear Store + Owner User + StoreHours en transacción
 *   3. Descargar branding (logo, banner, favicon) en background, persist URLs
 *   4. Crear cada categoría (preserva sortOrder del competidor)
 *   5. Crear productos: descargar `banner` como imagen principal, parsear
 *      descripción HTML, mapear precio. Variantes se omiten — Quick no las
 *      modela como entidades (las tallas están en texto libre en description).
 *      El owner las agrega después si quiere.
 *
 * Errores aislados: si una imagen no descarga, el producto se crea sin
 * imagen y se loggea en `warnings[]`. Sin fail-fast — el owner puede
 * agregar imágenes manualmente después.
 */

export type ImportInput = {
  sourceSlug: string;
  target: {
    slug: string;
    storeName: string;
    vertical: StoreVertical;
    city: string;
    whatsappPhone: string;
    ownerName: string;
    ownerIdentifier: string;
    ownerPassword: string;
  };
};

export type ImportResult = {
  storeId: string;
  storeSlug: string;
  categoriesCreated: number;
  productsCreated: number;
  imagesDownloaded: number;
  warnings: string[];
};

const STARTER_PLAN_SLUG = "starter";

export async function importQuickStore(input: ImportInput): Promise<ImportResult> {
  const warnings: string[] = [];

  // 1. Validaciones del target
  const slugCheck = validateSlug(slugify(input.target.slug));
  if (!slugCheck.ok) {
    throw new Error(
      `Slug "${input.target.slug}" inválido: ${slugCheck.reason === "reserved" ? "reservado" : "formato"}`,
    );
  }
  const targetSlug = slugCheck.value;

  const existingSlug = await db.store.findUnique({
    where: { slug: targetSlug },
    select: { id: true },
  });
  if (existingSlug) {
    throw new Error(`Ya existe una tienda con slug "${targetSlug}"`);
  }

  const ident = normalizeIdentifier(input.target.ownerIdentifier);
  if (ident.kind === "unknown") {
    throw new Error("El email/teléfono del owner es inválido");
  }
  const existingUser = await db.user.findUnique({
    where: { username: ident.value },
    select: { id: true },
  });
  if (existingUser) {
    throw new Error(`Ya existe una cuenta con identifier "${input.target.ownerIdentifier}"`);
  }

  const plan = await db.plan.findUnique({
    where: { slug: STARTER_PLAN_SLUG },
    select: { id: true },
  });
  if (!plan) {
    throw new Error(`No existe el plan "${STARTER_PLAN_SLUG}" en la DB (revisar seed)`);
  }

  const template = await db.template.findFirst({
    where: { vertical: input.target.vertical, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!template) {
    throw new Error(
      `No hay template activo para vertical ${input.target.vertical} (revisar seed)`,
    );
  }

  // 2. Fetch externo
  const [branding, categories] = await Promise.all([
    fetchQuickStoreData(input.sourceSlug),
    fetchQuickCatalog(input.sourceSlug),
  ]);

  // 3. Crear Store + User en una transacción.
  // Las imágenes y los productos van DESPUÉS de la TX porque incluyen IO
  // potencialmente lento (descarga de N imágenes); no queremos una TX
  // abierta por minutos.
  const passwordHash = await hashPassword(input.target.ownerPassword);
  const whatsappPhone = normalizePhoneBO(input.target.whatsappPhone);
  const email = ident.kind === "email" ? ident.value : null;
  const phone = ident.kind === "phone" ? ident.value : null;

  const { storeId } = await db.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        slug: targetSlug,
        name: input.target.storeName,
        vertical: input.target.vertical,
        status: StoreStatus.ACTIVE,
        templateId: template.id,
        planId: plan.id,
        billingCycle: BillingCycle.MONTHLY,
        whatsappPhone,
        city: input.target.city,
        description: branding.description,
      },
    });

    await tx.user.create({
      data: {
        username: ident.value,
        email,
        phone,
        passwordHash,
        role: Role.STORE_OWNER,
        fullName: input.target.ownerName,
        storeId: store.id,
        isActive: true,
      },
    });

    // Horarios default — el owner los edita después
    await tx.storeHours.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        storeId: store.id,
        dayOfWeek,
        openTime: "10:00",
        closeTime: "19:00",
        isClosed: dayOfWeek === 0, // domingo cerrado por default
      })),
    });

    return { storeId: store.id };
  });

  // 4. Branding: descargar logo, banner, favicon, persistir URLs
  let imagesDownloaded = 0;
  const brandingUpdates: Record<string, string> = {};
  for (const [field, kind, url] of [
    ["logoUrl", "logo", branding.logo],
    ["bannerUrl", "banner", branding.banner],
    ["faviconUrl", "favicon", branding.favicon],
  ] as const) {
    if (!url) continue;
    const saved = await downloadAndSave(url, storeId, kind);
    if (saved) {
      brandingUpdates[field] = saved;
      imagesDownloaded++;
    } else {
      warnings.push(`No pude descargar ${field} desde ${url}`);
    }
  }
  if (Object.keys(brandingUpdates).length > 0) {
    await db.store.update({
      where: { id: storeId },
      data: brandingUpdates,
    });
  }

  // 5. Categorías (preserva orden del competidor)
  const categoryIdMap = new Map<number, string>(); // quickId → ourId
  let categoriesCreated = 0;
  const usedSlugs = new Set<string>();

  for (const qCat of categories) {
    if (qCat.state !== 1) continue;
    const baseSlug = slugify(qCat.slug || qCat.name);
    let candidate = baseSlug;
    let suffix = 1;
    while (usedSlugs.has(candidate)) {
      candidate = `${baseSlug}-${suffix++}`;
    }
    const slugCheck2 = validateSlug(candidate);
    if (!slugCheck2.ok) {
      warnings.push(`Categoría "${qCat.name}" omitida (slug inválido)`);
      continue;
    }
    usedSlugs.add(slugCheck2.value);

    const created = await db.category.create({
      data: {
        storeId,
        name: qCat.name,
        slug: slugCheck2.value,
        sortOrder: qCat.order,
        isVisible: true,
      },
      select: { id: true },
    });
    categoryIdMap.set(qCat.id, created.id);
    categoriesCreated++;
  }

  // 6. Productos: aplanar (cada categoría puede tener +productos paginados)
  // y deduplicar por id (Quick devuelve el mismo product en múltiples cats
  // sólo si está pivoteado — para nosotros un product vive en UNA categoría).
  const productsByQuickId = new Map<number, { product: QuickProduct; categoryQuickId: number }>();

  for (const qCat of categories) {
    if (qCat.state !== 1) continue;
    // Primera tanda viene embebida
    for (const p of qCat.products ?? []) {
      if (p.state !== 1) continue;
      if (!productsByQuickId.has(p.id)) {
        productsByQuickId.set(p.id, { product: p, categoryQuickId: qCat.id });
      }
    }
    // Si products_count > los embebidos, paginar
    const embeddedCount = qCat.products?.length ?? 0;
    if (typeof qCat.products_count === "number" && qCat.products_count > embeddedCount) {
      try {
        const rest = await fetchCategoryProducts(qCat.id, 2);
        for (const p of rest) {
          if (p.state !== 1) continue;
          if (!productsByQuickId.has(p.id)) {
            productsByQuickId.set(p.id, { product: p, categoryQuickId: qCat.id });
          }
        }
      } catch (err) {
        warnings.push(
          `No pude paginar la categoría "${qCat.name}": ${(err as Error).message}`,
        );
      }
    }
  }

  // 7. Crear productos + descargar imágenes
  let productsCreated = 0;
  const usedProductSlugs = new Set<string>();
  for (const { product, categoryQuickId } of productsByQuickId.values()) {
    // `validateSlug` impone MAX_LEN=32 (pensado para slugs de tienda).
    // Para productos nombres como "DEMON SLAYER KIMETSU NO YAIBA TEES" se
    // pasan; truncamos a 30 chars + sufijo numérico si hubo colisión.
    // El último char no puede ser guión (constraint del regex), así que
    // recortamos los guiones colgantes.
    const fullSlug = slugify(product.name || `producto-${product.id}`);
    const baseSlug = fullSlug.slice(0, 30).replace(/-+$/, "") || `producto-${product.id}`;
    let candidate = baseSlug;
    let suffix = 1;
    while (usedProductSlugs.has(candidate)) {
      candidate = `${baseSlug}-${suffix++}`;
    }
    const slugCheck2 = validateSlug(candidate);
    if (!slugCheck2.ok) {
      warnings.push(`Producto "${product.name}" omitido (slug inválido)`);
      continue;
    }
    usedProductSlugs.add(slugCheck2.value);

    const categoryId = categoryIdMap.get(categoryQuickId) ?? null;
    const cleanDescription = stripHtml(product.description ?? "");
    const shortDescription =
      cleanDescription.length > 280
        ? cleanDescription.slice(0, 277) + "..."
        : cleanDescription;

    let savedImageUrl: string | null = null;
    if (product.banner) {
      savedImageUrl = await downloadAndSave(product.banner, storeId, "product");
      if (savedImageUrl) imagesDownloaded++;
      else warnings.push(`Imagen de "${product.name}" no descargó`);
    }

    await db.product.create({
      data: {
        storeId,
        categoryId,
        name: product.name.slice(0, 120),
        slug: slugCheck2.value,
        sku: product.code || null,
        description: cleanDescription || null,
        shortDescription: shortDescription || null,
        basePrice: new Prisma.Decimal(product.price),
        comparePrice:
          product.special_price && product.special_price > 0
            ? new Prisma.Decimal(product.special_price)
            : null,
        manageStock: false,
        isActive: true,
        ...(savedImageUrl
          ? {
              images: {
                create: { url: savedImageUrl, sortOrder: 0 },
              },
            }
          : {}),
      },
    });
    productsCreated++;
  }

  await audit({
    action: "store.registered",
    storeId,
    target: targetSlug,
    metadata: {
      importedFrom: "quick.com.bo",
      sourceSlug: input.sourceSlug,
      categoriesCreated,
      productsCreated,
      imagesDownloaded,
      warningsCount: warnings.length,
    },
  });

  return {
    storeId,
    storeSlug: targetSlug,
    categoriesCreated,
    productsCreated,
    imagesDownloaded,
    warnings,
  };
}

// ============== Helpers ==============

async function downloadAndSave(
  url: string,
  storeId: string,
  kind: ImageKind,
): Promise<string | null> {
  const buffer = await fetchImageBuffer(url);
  if (!buffer) return null;
  try {
    // Inferir MIME del primer byte (saveImage lo re-detecta igual con magic
    // bytes, pero el constructor de File requiere `type` por contrato).
    const mime = inferMime(buffer);
    const filename = `imported-${Date.now()}.${mime.split("/")[1]}`;
    const file = bufferToFile(buffer, filename, mime);
    const { url: savedUrl } = await saveImage(file, storeId, kind);
    return savedUrl;
  } catch (err) {
    console.error(`[quick-import] save image failed`, { url, error: err });
    return null;
  }
}

function inferMime(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  )
    return "image/webp";
  return "image/jpeg"; // fallback razonable; saveImage rechazará si es basura
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
