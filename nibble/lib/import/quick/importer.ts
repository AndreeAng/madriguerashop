import "server-only";
import { Prisma, Role, StoreStatus, BillingCycle, StoreVertical } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeIdentifier, normalizePhoneBO } from "@/lib/auth/identifiers";
import { slugify, validateSlug } from "@/lib/validation/slug";
import { saveImage, saveImageRaw, type ImageKind } from "@/lib/storage/upload";
import { audit } from "@/lib/audit/log";
import {
  fetchQuickCatalog,
  fetchQuickStoreData,
  fetchCategoryProducts,
  fetchImageBuffer,
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
    /**
     * Hash bcrypt de la contraseña del owner. El caller (admin action o
     * script) debe ejecutar `hashPassword` ANTES de invocar — recibimos
     * el hash, nunca el plano. Esto evita que la contraseña aparezca en
     * stack traces, logs APM o snapshots de errores si algo falla durante
     * el import.
     */
    ownerPasswordHash: string;
  };
  /**
   * ID del super admin que dispara el import. Se persiste en el audit log
   * de `store.registered` para trazabilidad: distingue un onboarding
   * orgánico (actorId null = autoservicio) de una migración del competidor
   * iniciada por un admin específico.
   */
  actorId?: string;
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
  const passwordHash = input.target.ownerPasswordHash;
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

  // 4. Branding: descargar logo, banner, favicon EN PARALELO.
  //    Para branding sí usamos `saveImage` (con sharp) porque son 3 imágenes
  //    que se ven mucho — vale la calidad. Para productos abajo usamos
  //    `saveImageRaw` para no quemar 30s de CPU en sharp con 90+ imágenes.
  let imagesDownloaded = 0;
  type BrandingField = "logoUrl" | "bannerUrl" | "faviconUrl";
  const brandingSpecs: Array<{ field: BrandingField; kind: ImageKind; url: string }> = [];
  if (branding.logo) brandingSpecs.push({ field: "logoUrl", kind: "logo", url: branding.logo });
  if (branding.banner) brandingSpecs.push({ field: "bannerUrl", kind: "banner", url: branding.banner });
  if (branding.favicon) brandingSpecs.push({ field: "faviconUrl", kind: "favicon", url: branding.favicon });

  const brandingResults = await Promise.all(
    brandingSpecs.map(async (spec) => ({
      spec,
      result: await downloadAndSaveBranding(spec.url, storeId, spec.kind),
    })),
  );
  const brandingUpdates: Partial<Record<BrandingField, string>> = {};
  for (const { spec, result } of brandingResults) {
    if (result.ok) {
      brandingUpdates[spec.field] = result.url;
      imagesDownloaded++;
    } else {
      warnings.push(`No pude descargar ${spec.field} desde ${spec.url}: ${result.error}`);
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

  // 7. Productos: preparar slugs únicos, descargar imágenes (pool de
  //    workers) y hacer BULK INSERT.
  //
  // Historial de iteraciones:
  //   - V1 secuencial: 90 imágenes × ~400ms = 36s — al borde del timeout.
  //   - V2 batches de 8: cada batch espera al MÁS LENTO (Promise.all),
  //     una imagen de 8s bloqueaba el batch entero → peor caso ~96s con
  //     92 imágenes contra Hobby (60s max). 504 garantizado.
  //   - V3 (esta) pool de workers + saveImageRaw (sin sharp) + bulk
  //     insert: siempre N en vuelo, sin barrera entre batches; sin
  //     re-encoding por imagen; 1 INSERT en lugar de 92 — debería bajar
  //     el tiempo total de ~60s a ~15-25s en una tienda de 90+ productos.
  type PreparedProduct = {
    quickProduct: QuickProduct;
    categoryQuickId: number;
    slug: string;
  };
  const prepared: PreparedProduct[] = [];
  const usedProductSlugs = new Set<string>();
  for (const { product, categoryQuickId } of productsByQuickId.values()) {
    // `validateSlug` impone MAX_LEN=32 (pensado para slugs de tienda).
    // Truncamos a 30 chars + sufijo numérico si hubo colisión. El último
    // char no puede ser guión (constraint del regex), así que recortamos.
    const fullSlug = slugify(product.name || `producto-${product.id}`);
    const baseSlug =
      fullSlug.slice(0, 30).replace(/-+$/, "") || `producto-${product.id}`;
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
    prepared.push({
      quickProduct: product,
      categoryQuickId,
      slug: slugCheck2.value,
    });
  }

  // Descargar TODAS las imágenes en paralelo con pool de workers.
  // Concurrencia 12: balance entre saturar la red sin disparar rate-limit
  // de Quick.com.bo ni del runner serverless (Vercel impone ~100 conexiones
  // outbound concurrentes).
  const imageResults = new Map<number, string>(); // quickProductId → savedUrl
  const productsWithImages = prepared.filter((p) => p.quickProduct.banner);
  await processWithWorkers(productsWithImages, 12, async (p) => {
    const url = p.quickProduct.banner!;
    const result = await downloadAndSaveRaw(url, storeId, "product");
    if (result.ok) {
      imageResults.set(p.quickProduct.id, result.url);
      imagesDownloaded++;
    } else {
      warnings.push(
        `Imagen de "${p.quickProduct.name}" no descargó: ${result.error}`,
      );
    }
  });

  // Bulk INSERT productos en una sola query. `createManyAndReturn` está
  // disponible en Prisma 5.14+ y devuelve los IDs auto-generados — vital
  // para insertar las ProductImage relacionadas después.
  const productCreateData = prepared.map((p) => {
    const cleanDescription = stripHtml(p.quickProduct.description ?? "");
    const shortDescription =
      cleanDescription.length > 280
        ? cleanDescription.slice(0, 277) + "..."
        : cleanDescription;
    return {
      storeId,
      categoryId: categoryIdMap.get(p.categoryQuickId) ?? null,
      name: p.quickProduct.name.slice(0, 120),
      slug: p.slug,
      sku: p.quickProduct.code || null,
      description: cleanDescription || null,
      shortDescription: shortDescription || null,
      basePrice: new Prisma.Decimal(p.quickProduct.price),
      comparePrice:
        p.quickProduct.special_price && p.quickProduct.special_price > 0
          ? new Prisma.Decimal(p.quickProduct.special_price)
          : null,
      manageStock: false,
      isActive: true,
    };
  });

  // 1 query para los 90+ productos en lugar de 92 INSERTs secuenciales.
  // En Neon ahorra ~5-9s solo en network roundtrips.
  const createdProducts = await db.product.createManyAndReturn({
    data: productCreateData,
    select: { id: true, slug: true },
  });
  const productsCreated = createdProducts.length;

  // Mapeo `productId` por `slug` (no por índice). createManyAndReturn de
  // Prisma 5.14+ documenta que devuelve los registros en el mismo orden
  // del input, pero usar un Map slug→id es defensivo: aunque cambie ese
  // contrato (Prisma upgrade, optimización del driver, etc.) seguiría
  // funcionando. Slugs son únicos por tienda por design — los garantizamos
  // arriba con `usedProductSlugs`.
  const productIdBySlug = new Map<string, string>(
    createdProducts.map((p) => [p.slug, p.id]),
  );
  const productImageData: Array<{ productId: string; url: string; sortOrder: number }> = [];
  for (const p of prepared) {
    const productId = productIdBySlug.get(p.slug);
    if (!productId) continue; // imposible si createMany no falló silently
    const savedUrl = imageResults.get(p.quickProduct.id);
    if (savedUrl) {
      productImageData.push({
        productId,
        url: savedUrl,
        sortOrder: 0,
      });
    }
  }
  if (productImageData.length > 0) {
    await db.productImage.createMany({ data: productImageData });
  }

  await audit({
    action: "store.registered",
    actorId: input.actorId ?? null,
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

/**
 * Descarga + guarda imagen. Discriminated union para que el caller
 * pueda reportar el error específico al usuario (timeout? 403? bad mime?).
 */
type DownloadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Branding (logo/banner/favicon): pasa por `saveImage` que SÍ aplica sharp
 * (resize al maxWidth del kind + conversión a WebP/PNG según el tipo).
 * Son sólo 3 imágenes — el costo de CPU vale la calidad consistente.
 */
async function downloadAndSaveBranding(
  url: string,
  storeId: string,
  kind: ImageKind,
): Promise<DownloadResult> {
  const result = await fetchImageBuffer(url);
  if (!result.ok) return { ok: false, error: result.error };
  try {
    const extension = result.mime.split("/")[1]?.split(";")[0] ?? "jpg";
    const filename = `imported-${Date.now()}.${extension}`;
    // Node 20+ tiene File global. Buffer es Uint8Array compatible con BlobPart.
    const bytes = new Uint8Array(result.buffer);
    const file = new File([bytes], filename, { type: result.mime });
    const { url: savedUrl } = await saveImage(file, storeId, kind);
    return { ok: true, url: savedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `saveImage falló: ${msg}` };
  }
}

/**
 * Productos (90+ por tienda): pasa por `saveImageRaw` que NO usa sharp.
 * Quick.com.bo ya sirve imágenes optimizadas para web — re-encodearlas
 * gastaría ~30s de CPU acumulados y nos tira contra el timeout de
 * Vercel Hobby. El owner puede re-optimizar después si quiere.
 */
async function downloadAndSaveRaw(
  url: string,
  storeId: string,
  kind: ImageKind,
): Promise<DownloadResult> {
  const result = await fetchImageBuffer(url);
  if (!result.ok) return { ok: false, error: result.error };
  try {
    const { url: savedUrl } = await saveImageRaw(
      result.buffer,
      result.mime,
      storeId,
      kind,
    );
    return { ok: true, url: savedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `saveImageRaw falló: ${msg}` };
  }
}

/**
 * Pool de N workers que consumen una queue compartida. Cada worker
 * procesa `fn(item)`; cuando termina, toma el siguiente item disponible
 * hasta que la queue se vacía.
 *
 * Comparado con `processInBatches` (que usa Promise.all por batch): el
 * pool nunca espera al "más lento" antes de avanzar. Si una request tarda
 * 8s, los otros workers siguen procesando — la latencia del worst-case no
 * se amplifica al batch entero. Importante cuando tienes imágenes con
 * latencias variables (CDN cache miss, hotlink protection, redirects).
 */
async function processWithWorkers<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        // `cursor++` es atómico en JS single-thread — no necesita lock.
        const idx = cursor++;
        const item = items[idx];
        if (item === undefined) break; // guard formal; idx < length lo asegura
        await fn(item);
      }
    },
  );
  await Promise.all(workers);
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
