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
import { INVALID_INPUT_ERROR, type ActionState } from "@/lib/validation/actionState";

// ============== Schemas ==============

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nombre muy corto").max(60),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(280).optional(),
  parentId: z.string().nullable().optional(),
  // imageUrl: solo paths relativos (/uploads/... vía nuestro endpoint de
  // upload) o https:// hacia hosts whitelisted en next.config.ts. Antes
  // aceptaba CUALQUIER https://, lo que permitía:
  //   1) SSRF latente si en el futuro alguien hace fetch server-side
  //      del imageUrl (ej. para generar thumbnails)
  //   2) Errors 500 en runtime cuando next/image rechaza un host no
  //      listado en `remotePatterns`
  //   3) Phishing — un atacante con acceso de owner mete URLs externas
  //      como "imagen" de categoría
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (v) =>
        v === "" ||
        v.startsWith("/uploads/") ||
        v.startsWith("/api/uploads/"),
      "Sube la imagen desde el botón — sólo se aceptan rutas internas",
    )
    .optional(),
});

type UpsertField = "name" | "slug" | "description" | "parentId" | "imageUrl";

// ============== Helpers ==============

function invalidate(storeSlug: string) {
  revalidatePath(`/${storeSlug}`);
  revalidatePath("/dashboard/categorias");
  revalidateTag(`store:${storeSlug}`);
}

// ============== Create / Update ==============

export async function upsertCategoryAction(
  _prev: ActionState<UpsertField>,
  formData: FormData,
): Promise<ActionState<UpsertField>> {
  const { storeId, userId } = await requireOwnerOnlyIds();

  const raw = {
    id: (formData.get("id") as string) || undefined,
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    parentId: ((formData.get("parentId") as string) || "") || null,
    imageUrl: String(formData.get("imageUrl") ?? ""),
  };

  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<UpsertField>(parsed.error) };
  }

  const data = parsed.data;

  // Slug: si no vino, derivar del nombre.
  const candidate = data.slug && data.slug.length > 0 ? slugify(data.slug) : slugify(data.name);
  const slugCheck = validateSlug(candidate);
  if (!slugCheck.ok) {
    return {
      fieldErrors: {
        slug:
          slugCheck.reason === "reserved"
            ? "Ese slug está reservado. Prueba otro."
            : "Slug inválido. Sólo letras, números y guiones.",
      },
    };
  }
  const slug = slugCheck.value;

  // Validar parentId pertenece a la misma tienda y no es el mismo registro
  if (data.parentId) {
    if (data.parentId === data.id) {
      return { fieldErrors: { parentId: "Una categoría no puede ser su propia padre" } };
    }
    const parent = await db.category.findFirst({
      where: { id: data.parentId, storeId },
      select: { id: true, parentId: true },
    });
    if (!parent) return { fieldErrors: { parentId: "Categoría padre no encontrada" } };
    // Evitar bucles (por ahora sólo prohibimos categoría con ya un padre como nuevo padre)
    if (parent.parentId) {
      return {
        fieldErrors: { parentId: "Sólo se permite un nivel de subcategorías" },
      };
    }
  }

  try {
    if (data.id) {
      const existing = await db.category.findFirst({
        where: { id: data.id, storeId },
        select: { id: true },
      });
      if (!existing) return { error: "Categoría no encontrada" };

      await db.category.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          parentId: data.parentId,
          imageUrl: data.imageUrl || null,
        },
      });
    } else {
      // sortOrder = max + 1 dentro del mismo nivel
      const maxOrder = await db.category.aggregate({
        where: { storeId, parentId: data.parentId ?? null },
        _max: { sortOrder: true },
      });
      await db.category.create({
        data: {
          storeId,
          name: data.name,
          slug,
          description: data.description || null,
          parentId: data.parentId ?? null,
          imageUrl: data.imageUrl || null,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        },
      });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { slug: "Ya existe una categoría con ese slug." } };
    }
    throw err;
  }

  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: data.id ? "category.updated" : "category.created",
    actorId: userId,
    storeId,
    target: data.id ?? null,
    metadata: { name: data.name, slug },
  });
  return { ok: true };
}

// ============== Delete ==============

export async function deleteCategoryAction(formData: FormData): Promise<ActionState> {
  const { storeId, userId } = await requireOwnerOnlyIds();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ID requerido" };

  const existing = await db.category.findFirst({
    where: { id, storeId },
    select: { id: true, name: true, slug: true, _count: { select: { products: true, children: true } } },
  });
  if (!existing) return { error: "Categoría no encontrada" };

  if (existing._count.products > 0) {
    return {
      error: `No se puede eliminar: tiene ${existing._count.products} producto(s) asociado(s). Movelos primero.`,
    };
  }
  if (existing._count.children > 0) {
    return {
      error: `No se puede eliminar: tiene ${existing._count.children} subcategoría(s). Eliminá las subcategorías primero.`,
    };
  }

  await db.category.delete({ where: { id } });
  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: "category.deleted",
    actorId: userId,
    storeId,
    target: id,
    metadata: { name: existing.name, slug: existing.slug },
  });
  return { ok: true };
}

// ============== Toggle visibility ==============

export async function toggleCategoryVisibilityAction(formData: FormData): Promise<ActionState> {
  const { storeId, userId } = await requireOwnerOnlyIds();
  const id = String(formData.get("id") ?? "");

  // Read-then-write atómico: leemos el estado real de DB en lugar de confiar
  // en el value del form (que puede estar stale si otro tab lo cambió).
  const existing = await db.category.findFirst({
    where: { id, storeId },
    select: { id: true, isVisible: true },
  });
  if (!existing) return { error: "Categoría no encontrada" };

  await db.category.update({
    where: { id: existing.id },
    data: { isVisible: !existing.isVisible },
  });
  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: "category.toggled_visibility",
    actorId: userId,
    storeId,
    target: existing.id,
    metadata: { isVisible: !existing.isVisible },
  });
  return { ok: true };
}

// ============== Reorder ==============

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function reorderCategoriesAction(input: {
  ids: string[];
}): Promise<ActionState> {
  const { storeId, userId } = await requireOwnerOnlyIds();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  // Validar que todas las IDs son de esta tienda
  const found = await db.category.findMany({
    where: { id: { in: parsed.data.ids }, storeId },
    select: { id: true },
  });
  if (found.length !== parsed.data.ids.length) {
    return { error: "Una o más categorías no pertenecen a tu tienda" };
  }

  await db.$transaction(
    parsed.data.ids.map((id, idx) =>
      db.category.update({ where: { id }, data: { sortOrder: idx } }),
    ),
  );

  invalidate(await getStoreSlugById(storeId));
  await audit({
    action: "category.reordered",
    actorId: userId,
    storeId,
    metadata: { count: parsed.data.ids.length },
  });
  return { ok: true };
}
