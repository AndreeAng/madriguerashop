"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  Prisma,
  Role,
  StoreStatus,
  BillingCycle,
  StoreVertical,
} from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  normalizeIdentifier,
  normalizePhoneBO,
  PHONE_BO_RE,
} from "@/lib/auth/identifiers";
import { slugify, validateSlug } from "@/lib/validation/slug";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { audit } from "@/lib/audit/log";
import { requireSuperAdminOrFail } from "@/lib/auth/session";
import {
  clearImpersonatedStore,
  readImpersonatedStoreId,
  setImpersonatedStore,
} from "@/lib/auth/impersonation";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";

// ============== Tipos ==============

export type AdminCreateStoreState = {
  ok?: true;
  error?: string;
  /** Slug de la tienda recién creada — usado para redirigir desde el form. */
  createdSlug?: string;
  fieldErrors?: Partial<
    Record<
      | "storeName"
      | "slug"
      | "vertical"
      | "whatsappPhone"
      | "city"
      | "planSlug"
      | "ownerName"
      | "ownerIdentifier"
      | "ownerPassword",
      string
    >
  >;
};

export type AdminAssignOwnerState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<
    Record<"ownerName" | "ownerIdentifier" | "ownerPassword", string>
  >;
};

// ============== Schemas ==============

// Base de la tienda: campos obligatorios sin importar si hay owner o no.
const storeBaseSchema = z.object({
  storeName: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  slug: z.string().trim().min(1, "Elegí un identificador"),
  vertical: z.nativeEnum(StoreVertical, { message: "Elegí el rubro" }),
  whatsappPhone: z
    .string()
    .trim()
    .refine(
      (v) => PHONE_BO_RE.test(v.replace(/[\s-]/g, "")),
      "Teléfono inválido. Formato: +591XXXXXXXX",
    ),
  city: z.string().trim().min(2, "Ingresá la ciudad").max(60),
  planSlug: z.string().trim().min(1, "Elegí un plan"),
  /** Si está marcado, la tienda aparece en /tiendas. Para demos lo dejas
   * apagado: el cliente ve su tienda por URL directa, pero no en el
   * directorio público. */
  isPubliclyListed: z.boolean().default(false),
});

// Owner opcional. Si vienen campos llenados parcialmente, validamos todos.
const ownerOptionalSchema = z.object({
  ownerName: z.string().trim().max(80).optional().default(""),
  ownerIdentifier: z.string().trim().max(120).optional().default(""),
  ownerPassword: z.string().max(MAX_PASSWORD_LENGTH).optional().default(""),
});

const createSchema = storeBaseSchema.merge(ownerOptionalSchema).superRefine(
  (v, ctx) => {
    // Si TOCÓ algún campo de owner, exigir los 3.
    const someFilled =
      v.ownerName.length > 0 ||
      v.ownerIdentifier.length > 0 ||
      v.ownerPassword.length > 0;
    if (!someFilled) return; // tienda sin owner — válido.

    if (v.ownerName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerName"],
        message: "Mínimo 2 caracteres",
      });
    }
    if (v.ownerIdentifier.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerIdentifier"],
        message: "Email o teléfono del owner",
      });
    }
    if (v.ownerPassword.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerPassword"],
        message: "Mínimo 8 caracteres",
      });
    }
  },
);

// Asignar owner a tienda existente: los 3 campos son obligatorios.
const assignOwnerSchema = z.object({
  storeId: z.string().min(1),
  ownerName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  ownerIdentifier: z.string().trim().min(1, "Email o teléfono").max(120),
  ownerPassword: z.string().min(8, "Mínimo 8 caracteres").max(MAX_PASSWORD_LENGTH),
});

// ============== Helpers ==============

/**
 * Resuelve el template a usar para una vertical. Toma el primero `isActive`
 * por `sortOrder`. Si la vertical pedida no tiene template propio (ej.
 * BAKERY, BEAUTY o OTHER no están en el seed inicial), cae a RETAIL como
 * base genérica — el owner puede personalizar después desde su dashboard.
 * Devuelve null sólo si la DB no tiene NINGÚN template activo (caso patológico).
 */
async function pickTemplateForVertical(
  vertical: StoreVertical,
): Promise<string | null> {
  const exact = await db.template.findFirst({
    where: { vertical, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (exact) return exact.id;

  // Fallback: RETAIL es el más genérico (productos en grilla).
  const retail = await db.template.findFirst({
    where: { vertical: "RETAIL", isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (retail) return retail.id;

  // Último recurso: cualquier template activo. Mejor un layout cualquiera
  // que rechazar la creación de la tienda.
  const any = await db.template.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return any?.id ?? null;
}

// ============== Crear tienda ==============

export async function adminCreateStoreAction(
  _prev: AdminCreateStoreState,
  formData: FormData,
): Promise<AdminCreateStoreState> {
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) return { error: guard.error };

  const parsed = createSchema.safeParse({
    storeName: formData.get("storeName"),
    slug: formData.get("slug"),
    vertical: formData.get("vertical"),
    whatsappPhone: formData.get("whatsappPhone"),
    city: formData.get("city"),
    planSlug: formData.get("planSlug"),
    isPubliclyListed: formData.get("isPubliclyListed") === "on",
    ownerName: formData.get("ownerName") ?? "",
    ownerIdentifier: formData.get("ownerIdentifier") ?? "",
    ownerPassword: formData.get("ownerPassword") ?? "",
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<AdminCreateStoreState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  // Slug: normalizar + chequear reservados.
  const slugCheck = validateSlug(slugify(data.slug));
  if (!slugCheck.ok) {
    return {
      fieldErrors: {
        slug:
          slugCheck.reason === "reserved"
            ? "Identificador reservado."
            : "Identificador inválido. Sólo letras, números y guiones.",
      },
    };
  }
  const slug = slugCheck.value;

  // Owner data si vino. Distinguir kind (email|phone) para llenar User.
  const hasOwner = data.ownerIdentifier.length > 0;
  let ownerData: {
    username: string;
    email: string | null;
    phone: string | null;
    passwordHash: string;
    fullName: string;
  } | null = null;
  if (hasOwner) {
    const ident = normalizeIdentifier(data.ownerIdentifier);
    if (ident.kind === "unknown") {
      return {
        fieldErrors: { ownerIdentifier: "Email o teléfono inválido" },
      };
    }
    const existing = await db.user.findUnique({
      where: { username: ident.value },
      select: { id: true },
    });
    if (existing) {
      return {
        fieldErrors: {
          ownerIdentifier:
            "Ya existe una cuenta con este email/teléfono. Asignala desde el detalle de la tienda.",
        },
      };
    }
    ownerData = {
      username: ident.value,
      email: ident.kind === "email" ? ident.value : null,
      phone: ident.kind === "phone" ? ident.value : null,
      passwordHash: await hashPassword(data.ownerPassword),
      fullName: data.ownerName,
    };
  }

  // Plan + template lookup.
  const [plan, templateId] = await Promise.all([
    db.plan.findUnique({
      where: { slug: data.planSlug },
      select: { id: true },
    }),
    pickTemplateForVertical(data.vertical),
  ]);
  if (!plan) {
    return { fieldErrors: { planSlug: "Plan no encontrado" } };
  }
  if (!templateId) {
    return {
      error: `No hay template activo para ${data.vertical}. Creá uno en /admin/plantillas.`,
    };
  }

  const whatsappPhone = normalizePhoneBO(data.whatsappPhone);
  let createdId: string | null = null;

  try {
    await db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          slug,
          name: data.storeName,
          vertical: data.vertical,
          status: StoreStatus.ACTIVE,
          templateId,
          planId: plan.id,
          billingCycle: BillingCycle.MONTHLY,
          whatsappPhone,
          city: data.city,
          isPubliclyListed: data.isPubliclyListed,
        },
      });
      createdId = store.id;

      if (ownerData) {
        await tx.user.create({
          data: {
            ...ownerData,
            role: Role.STORE_OWNER,
            storeId: store.id,
            isActive: true,
          },
        });
      }

      // Horarios default: Lun–Dom 09:00–21:00. El owner los edita después.
      await tx.storeHours.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          storeId: store.id,
          dayOfWeek,
          openTime: "09:00",
          closeTime: "21:00",
          isClosed: false,
        })),
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.includes("slug")) {
        return { fieldErrors: { slug: "Este identificador ya está en uso." } };
      }
      if (
        target.includes("username") ||
        target.includes("email") ||
        target.includes("phone")
      ) {
        return {
          fieldErrors: {
            ownerIdentifier: "Ya existe una cuenta con este email/teléfono.",
          },
        };
      }
    }
    throw err;
  }

  if (!createdId) {
    return { error: "No pudimos crear la tienda. Prueba de nuevo." };
  }

  await audit({
    action: "store.registered",
    actorId: guard.id,
    target: createdId,
    metadata: {
      slug,
      vertical: data.vertical,
      adminCreated: true,
      hasOwner,
      isPubliclyListed: data.isPubliclyListed,
    },
  });

  revalidatePath("/admin/tiendas");
  revalidatePath("/tiendas");

  return { ok: true, createdSlug: slug };
}

// ============== Transferir owner (tienda activa) ==============
//
// Diferente de `adminAssignOwnerAction`: ese exige que la tienda NO tenga
// owner; este sí. Caso de uso: cliente vende su tienda a otro, o el dueño
// original renunció y hay que poner uno nuevo sin perder el catálogo.
//
// Atómico: en una transacción suspendemos a todos los owners activos
// previos y creamos/asignamos el nuevo. Si algo falla, ni los viejos
// quedan suspendidos a la mitad ni el nuevo queda creado sin tienda.

export async function adminTransferOwnerAction(
  _prev: AdminAssignOwnerState,
  formData: FormData,
): Promise<AdminAssignOwnerState> {
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) return { error: guard.error };

  const parsed = assignOwnerSchema.safeParse({
    storeId: formData.get("storeId"),
    ownerName: formData.get("ownerName"),
    ownerIdentifier: formData.get("ownerIdentifier"),
    ownerPassword: formData.get("ownerPassword"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<AdminAssignOwnerState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  const store = await db.store.findUnique({
    where: { id: data.storeId },
    select: { id: true, slug: true },
  });
  if (!store) return { error: "Tienda no encontrada" };

  const ident = normalizeIdentifier(data.ownerIdentifier);
  if (ident.kind === "unknown") {
    return { fieldErrors: { ownerIdentifier: "Email o teléfono inválido" } };
  }

  const existing = await db.user.findUnique({
    where: { username: ident.value },
    select: { id: true },
  });
  if (existing) {
    return {
      fieldErrors: {
        ownerIdentifier: "Ya existe una cuenta con este email/teléfono.",
      },
    };
  }

  const passwordHash = await hashPassword(data.ownerPassword);
  const suspendedIds: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      // 1. Suspender owners activos previos. Los dejamos asociados a la
      //    tienda (no movemos `storeId=null`) por trazabilidad histórica:
      //    el admin después puede ver "Romina fue owner hasta el 12/05".
      const oldOwners = await tx.user.findMany({
        where: { storeId: store.id, role: Role.STORE_OWNER, isActive: true },
        select: { id: true },
      });
      for (const o of oldOwners) suspendedIds.push(o.id);
      if (oldOwners.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: oldOwners.map((o) => o.id) } },
          data: { isActive: false },
        });
      }

      // 2. Crear el nuevo owner.
      await tx.user.create({
        data: {
          username: ident.value,
          email: ident.kind === "email" ? ident.value : null,
          phone: ident.kind === "phone" ? ident.value : null,
          passwordHash,
          role: Role.STORE_OWNER,
          fullName: data.ownerName,
          storeId: store.id,
          isActive: true,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        fieldErrors: {
          ownerIdentifier: "Ya existe una cuenta con este email/teléfono.",
        },
      };
    }
    throw err;
  }

  await audit({
    action: "saas.user_role_changed",
    actorId: guard.id,
    target: store.id,
    metadata: {
      slug: store.slug,
      adminTransferredOwner: true,
      suspendedOwnerIds: suspendedIds,
    },
  });

  revalidatePath(`/admin/tiendas/${store.id}`);
  revalidatePath("/admin/tiendas");
  return { ok: true };
}

// ============== Asignar owner a tienda existente ==============

export async function adminAssignOwnerAction(
  _prev: AdminAssignOwnerState,
  formData: FormData,
): Promise<AdminAssignOwnerState> {
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) return { error: guard.error };

  const parsed = assignOwnerSchema.safeParse({
    storeId: formData.get("storeId"),
    ownerName: formData.get("ownerName"),
    ownerIdentifier: formData.get("ownerIdentifier"),
    ownerPassword: formData.get("ownerPassword"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<AdminAssignOwnerState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;

  const ident = normalizeIdentifier(data.ownerIdentifier);
  if (ident.kind === "unknown") {
    return { fieldErrors: { ownerIdentifier: "Email o teléfono inválido" } };
  }

  const passwordHash = await hashPassword(data.ownerPassword);

  // Envolvemos los 3 pasos (verificar store sin owner, verificar username
  // libre, crear user) en una transacción. Sin esto, dos super-admins que
  // asignen owner concurrentemente podrían ambos pasar el check y crear
  // dos owners para la misma store. La transacción no garantiza
  // serializabilidad bajo Postgres READ COMMITTED, pero cierra la ventana
  // significativamente y delega el caso extremo al P2002 unique violation
  // del index de username.
  let storeSnapshot: { id: string; slug: string };
  try {
    storeSnapshot = await db.$transaction(async (tx) => {
      const s = await tx.store.findUnique({
        where: { id: data.storeId },
        select: {
          id: true,
          slug: true,
          users: {
            where: { role: Role.STORE_OWNER, isActive: true },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!s) throw new Error("__not_found__");
      if (s.users.length > 0) throw new Error("__has_owner__");

      const existing = await tx.user.findUnique({
        where: { username: ident.value },
        select: { id: true },
      });
      if (existing) throw new Error("__username_taken__");

      await tx.user.create({
        data: {
          username: ident.value,
          email: ident.kind === "email" ? ident.value : null,
          phone: ident.kind === "phone" ? ident.value : null,
          passwordHash,
          role: Role.STORE_OWNER,
          fullName: data.ownerName,
          storeId: s.id,
          isActive: true,
        },
      });

      return { id: s.id, slug: s.slug };
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "__not_found__") return { error: "Tienda no encontrada" };
      if (err.message === "__has_owner__") {
        return {
          error: "Esta tienda ya tiene owner. Suspendelo antes de asignar otro.",
        };
      }
      if (err.message === "__username_taken__") {
        return {
          fieldErrors: {
            ownerIdentifier: "Ya existe una cuenta con este email/teléfono.",
          },
        };
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Race que ganó el otro admin: el username quedó tomado entre nuestro
      // chequeo y el create. Tratamos igual que "ya existe".
      return {
        fieldErrors: {
          ownerIdentifier: "Ya existe una cuenta con este email/teléfono.",
        },
      };
    }
    throw err;
  }

  await audit({
    action: "store.registered",
    actorId: guard.id,
    target: storeSnapshot.id,
    metadata: {
      slug: storeSnapshot.slug,
      adminAssignedOwner: true,
    },
  });

  revalidatePath(`/admin/tiendas/${storeSnapshot.id}`);
  revalidatePath("/admin/tiendas");

  return { ok: true };
}

// ============== Impersonation (modo configuración) ==============
//
// Un SUPER_ADMIN puede entrar al `/dashboard` de cualquier tienda como si
// fuera su owner para configurarla (cargar productos, ajustar settings,
// etc.). Útil sobre todo para tiendas demo sin owner asignado.
//
// El flow: setear cookie `admin_impersonate_store=<storeId>` → redirigir a
// /dashboard → los guards `requireStoreOwner`/`requireOwnerOnly` ven la
// cookie + SUPER_ADMIN y devuelven esa store. Cuando termina, otra action
// borra la cookie.

export async function adminEnterStoreAction(storeId: string): Promise<void> {
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) {
    // Sin contexto de form, tiramos para que Next muestre la error page.
    throw new Error(guard.error);
  }

  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { id: true, slug: true, name: true },
  });
  if (!store) throw new Error("Tienda no encontrada");

  await setImpersonatedStore(store.id);
  await audit({
    action: "saas.store_impersonation_started",
    actorId: guard.id,
    target: store.id,
    metadata: { slug: store.slug },
  });

  redirect("/dashboard");
}

export async function adminExitStoreAction(): Promise<void> {
  // No exigimos super admin acá: si por algún motivo la cookie quedó pegada
  // sin sesión válida, igual queremos poder limpiarla.
  const storeId = await readImpersonatedStoreId();
  await clearImpersonatedStore();

  if (storeId) {
    // Best-effort audit: si hay sesión de admin, lo registramos.
    const guard = await requireSuperAdminOrFail();
    if (!("error" in guard)) {
      await audit({
        action: "saas.store_impersonation_ended",
        actorId: guard.id,
        target: storeId,
        metadata: {},
      });
    }
    redirect(`/admin/tiendas/${storeId}`);
  }
  redirect("/admin/tiendas");
}

// ============== Redirect post-create ==============
// Wrapper que combina la action con un redirect al detalle. Útil para forms
// que no quieren manejar el estado de "ok+slug" del lado cliente.
export async function adminCreateStoreAndRedirect(
  prev: AdminCreateStoreState,
  formData: FormData,
): Promise<AdminCreateStoreState> {
  const result = await adminCreateStoreAction(prev, formData);
  if (result.ok && result.createdSlug) {
    // Buscamos el id por slug porque la action no lo expone (devuelve slug).
    const store = await db.store.findUnique({
      where: { slug: result.createdSlug },
      select: { id: true },
    });
    if (store) redirect(`/admin/tiendas/${store.id}`);
  }
  return result;
}
