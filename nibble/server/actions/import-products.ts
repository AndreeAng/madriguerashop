"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { slugify, validateSlug } from "@/lib/validation/slug";
import { audit } from "@/lib/audit/log";
import { parseCsv } from "@/lib/import/csv-parser";

/**
 * Importación masiva de productos desde CSV.
 *
 * Columnas reconocidas (header en la primera fila, case-insensitive):
 *   nombre       (REQUERIDO)
 *   precio       (REQUERIDO, número con punto decimal, ej: 89.50)
 *   slug         opcional — si vacío, se deriva del nombre
 *   sku          opcional
 *   categoría    opcional — debe existir en la tienda (match por slug o nombre)
 *   stock        opcional — número entero; si presente, manageStock=true
 *   descripción  opcional — descripción corta (hasta 280 chars)
 *
 * Comportamiento:
 *   - Procesa fila por fila. Filas inválidas se reportan en `errors[]` y
 *     NO bloquean a las válidas — el owner recibe el resumen.
 *   - Duplicados por slug se omiten (no se actualizan): el flow correcto
 *     para editar productos existentes es la UI de productos.
 *   - Categorías: si se especifica una que no existe, la fila falla
 *     (no la creamos auto para evitar typos que generen categorías basura).
 */

export type ImportProductsState = {
  ok?: true;
  created?: number;
  skipped?: number;
  errors?: { line: number; reason: string }[];
  error?: string;
};

const MAX_ROWS = 1000;

function readNumber(v: string): number | null {
  if (!v) return null;
  // Normalizar coma como separador decimal — algunos Excel BO usan "," por locale
  const normalized = v.replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export async function importProductsAction(
  _prev: ImportProductsState,
  formData: FormData,
): Promise<ImportProductsState> {
  const { storeId, userId } = await requireOwnerOnlyIds();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Sube un archivo CSV." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "El archivo es muy grande (máx 2MB)." };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { error: "No se pudo leer el archivo." };
  }

  const parsed = parseCsv(text);
  if (parsed.rows.length === 0) {
    return { error: "El CSV está vacío o no tiene filas de datos." };
  }
  if (parsed.rows.length > MAX_ROWS) {
    return {
      error: `Máximo ${MAX_ROWS} filas por import. Dividilo en archivos más chicos.`,
    };
  }

  // Headers requeridos
  if (!parsed.headers.includes("nombre") || !parsed.headers.includes("precio")) {
    return {
      error:
        'El CSV debe tener al menos las columnas "nombre" y "precio" en la primera fila.',
    };
  }

  // Pre-cargar categorías de la tienda — evita N+1 queries en el loop
  const categories = await db.category.findMany({
    where: { storeId },
    select: { id: true, name: true, slug: true },
  });
  const categoryByKey = new Map<string, string>();
  for (const c of categories) {
    categoryByKey.set(c.slug.toLowerCase(), c.id);
    categoryByKey.set(c.name.toLowerCase(), c.id);
  }

  // Pre-cargar slugs existentes para evitar reintento de upsert por cada fila
  const existing = await db.product.findMany({
    where: { storeId },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((p) => p.slug));

  const errors: { line: number; reason: string }[] = [...parsed.parseErrors];
  const toCreate: Prisma.ProductCreateManyInput[] = [];
  const seenSlugsInBatch = new Set<string>();

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]!;
    const line = i + 2; // +1 por header, +1 porque 1-indexed

    const name = row["nombre"]?.trim();
    if (!name || name.length < 2) {
      errors.push({ line, reason: "nombre requerido (mín 2 chars)" });
      continue;
    }
    if (name.length > 120) {
      errors.push({ line, reason: "nombre demasiado largo (máx 120)" });
      continue;
    }

    const priceNum = readNumber(row["precio"] ?? "");
    if (priceNum === null || priceNum < 0) {
      errors.push({ line, reason: "precio inválido (debe ser número >= 0)" });
      continue;
    }

    const slugRaw = row["slug"] || name;
    const slugCheck = validateSlug(slugify(slugRaw));
    if (!slugCheck.ok) {
      errors.push({
        line,
        reason: `slug inválido: ${slugCheck.reason === "reserved" ? "reservado" : "formato"}`,
      });
      continue;
    }
    const slug = slugCheck.value;
    if (existingSlugs.has(slug) || seenSlugsInBatch.has(slug)) {
      errors.push({ line, reason: `slug duplicado: "${slug}"` });
      continue;
    }
    seenSlugsInBatch.add(slug);

    let categoryId: string | null = null;
    const catRaw = row["categoría"] ?? row["categoria"] ?? "";
    if (catRaw) {
      const match = categoryByKey.get(catRaw.toLowerCase());
      if (!match) {
        errors.push({ line, reason: `categoría "${catRaw}" no existe en tu tienda` });
        continue;
      }
      categoryId = match;
    }

    const stockRaw = row["stock"] ?? "";
    let stock = 0;
    let manageStock = false;
    if (stockRaw) {
      const n = readNumber(stockRaw);
      if (n === null || n < 0 || !Number.isInteger(n)) {
        errors.push({ line, reason: "stock debe ser entero >= 0" });
        continue;
      }
      stock = n;
      manageStock = true;
    }

    const description = (row["descripción"] ?? row["descripcion"] ?? "").slice(0, 280);

    toCreate.push({
      storeId,
      name,
      slug,
      sku: row["sku"] || null,
      shortDescription: description || null,
      basePrice: new Prisma.Decimal(priceNum),
      manageStock,
      stock,
      categoryId,
      isActive: true,
    });
  }

  // Enforce plan-limit dentro de un advisory lock per-tenant — mismo patrón
  // que `upsertProductAction`. Sin esto un owner sube un CSV con 1000 filas
  // y se salta el límite del plan: el `createMany` no chequea nada y la UI
  // solo enforce en el flow de productos uno-a-uno. Si el batch completo
  // no cabe, abortamos el import entero (decisión: "todo o nada" es más
  // predecible para el owner que importar parcialmente y dejarlo cerca del
  // tope sin saberlo).
  let created = 0;
  if (toCreate.length > 0) {
    const { checkProductLimit } = await import("@/lib/billing/plan-limits");
    const limitError = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(42, hashtext($1))`,
        `product-limit:${storeId}`,
      );
      const limit = await checkProductLimit(storeId, tx);
      if (limit.limit !== null && limit.current + toCreate.length > limit.limit) {
        const room = Math.max(0, limit.limit - limit.current);
        return (
          `Tu plan permite ${limit.limit} productos activos. ` +
          `Tenes ${limit.current} y este CSV agregaría ${toCreate.length}. ` +
          (room === 0
            ? "Suspende productos o sube de plan antes de importar."
            : `Reduce el archivo a ${room} filas o sube de plan.`)
        );
      }
      const result = await tx.product.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
      return result.count;
    });

    if (typeof limitError === "string") {
      return { error: limitError };
    }
    created = limitError;
  }

  await audit({
    action: "product.created",
    actorId: userId,
    storeId,
    metadata: {
      bulkImport: true,
      created,
      skipped: parsed.rows.length - created,
      errorsCount: errors.length,
    },
  });

  revalidatePath("/dashboard/productos");

  return {
    ok: true,
    created,
    skipped: parsed.rows.length - created,
    errors: errors.slice(0, 100), // cap para no devolver MB de errores al cliente
  };
}
