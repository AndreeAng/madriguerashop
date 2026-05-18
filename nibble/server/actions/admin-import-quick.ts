"use server";

import { z } from "zod";
import { StoreVertical } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth/session";
import { PHONE_BO_RE } from "@/lib/auth/identifiers";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { importQuickStore } from "@/lib/import/quick/importer";

export type ImportQuickState = {
  ok?: true;
  result?: {
    storeSlug: string;
    categoriesCreated: number;
    productsCreated: number;
    imagesDownloaded: number;
    warnings: string[];
  };
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "sourceSlug"
      | "slug"
      | "storeName"
      | "vertical"
      | "city"
      | "whatsappPhone"
      | "ownerName"
      | "ownerIdentifier"
      | "ownerPassword",
      string
    >
  >;
};

const QUICK_HOST_RE = /(?:https?:\/\/)?cat\.quick\.com\.bo\/([a-z0-9-]+)\/?$/i;

const schema = z.object({
  sourceUrl: z.string().min(1, "Pegá la URL de la tienda de Quick"),
  slug: z.string().min(1),
  storeName: z.string().trim().min(2).max(60),
  vertical: z.nativeEnum(StoreVertical),
  city: z.string().trim().min(2).max(60),
  whatsappPhone: z
    .string()
    .trim()
    .refine(
      (v) => PHONE_BO_RE.test(v.replace(/[\s-]/g, "")),
      "Teléfono inválido (+591XXXXXXXX)",
    ),
  ownerName: z.string().trim().min(2).max(80),
  ownerIdentifier: z.string().trim().min(3).max(120),
  ownerPassword: z.string().min(8).max(128),
});

/**
 * Importa una tienda de cat.quick.com.bo al SaaS.
 *
 * Solo super-admin: este es un feature interno para ganar clientes del
 * competidor — el dueño potencial nos da el slug de su tienda actual y
 * nosotros migramos catálogo + branding en minutos.
 *
 * Si el import es exitoso, devuelve el slug nuevo + counts. La UI redirige
 * al detalle de la tienda nueva en /admin/tiendas/{id}.
 */
export async function adminImportQuickAction(
  _prev: ImportQuickState,
  formData: FormData,
): Promise<ImportQuickState> {
  await requireSuperAdmin();

  const parsed = schema.safeParse({
    sourceUrl: formData.get("sourceUrl"),
    slug: formData.get("slug"),
    storeName: formData.get("storeName"),
    vertical: formData.get("vertical"),
    city: formData.get("city"),
    whatsappPhone: formData.get("whatsappPhone"),
    ownerName: formData.get("ownerName"),
    ownerIdentifier: formData.get("ownerIdentifier"),
    ownerPassword: formData.get("ownerPassword"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<ImportQuickState["fieldErrors"]>
      >(parsed.error),
    };
  }

  // Extraer slug del competidor desde la URL
  const match = parsed.data.sourceUrl.match(QUICK_HOST_RE);
  if (!match || !match[1]) {
    return {
      fieldErrors: {
        sourceSlug: "URL debe tener el formato https://cat.quick.com.bo/{slug}",
      },
    };
  }
  const sourceSlug = match[1].toLowerCase();

  try {
    const result = await importQuickStore({
      sourceSlug,
      target: {
        slug: parsed.data.slug,
        storeName: parsed.data.storeName,
        vertical: parsed.data.vertical,
        city: parsed.data.city,
        whatsappPhone: parsed.data.whatsappPhone,
        ownerName: parsed.data.ownerName,
        ownerIdentifier: parsed.data.ownerIdentifier,
        ownerPassword: parsed.data.ownerPassword,
      },
    });

    return {
      ok: true,
      result: {
        storeSlug: result.storeSlug,
        categoriesCreated: result.categoriesCreated,
        productsCreated: result.productsCreated,
        imagesDownloaded: result.imagesDownloaded,
        warnings: result.warnings,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { error: message };
  }
}
