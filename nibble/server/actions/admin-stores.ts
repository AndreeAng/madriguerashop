"use server";

import path from "node:path";
import { rm } from "node:fs/promises";
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
import { del, list, type ListBlobResult } from "@vercel/blob";
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
import { revertOrderImpact } from "@/server/actions/order-management";
import { requireSuperAdminOrFail } from "@/lib/auth/session";
import {
  clearImpersonatedStore,
  readImpersonatedStoreId,
  setImpersonatedStore,
} from "@/lib/auth/impersonation";
import { proofUploadDir } from "@/lib/storage/upload";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";
import { captureError } from "@/lib/observability/captureError";

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
  slug: z.string().trim().min(1, "Elige un identificador"),
  vertical: z.nativeEnum(StoreVertical, { message: "Elige el rubro" }),
  whatsappPhone: z
    .string()
    .trim()
    .refine(
      (v) => PHONE_BO_RE.test(v.replace(/[\s-]/g, "")),
      "Teléfono inválido. Formato: +591XXXXXXXX",
    ),
  city: z.string().trim().min(2, "Ingresa la ciudad").max(60),
  planSlug: z.string().trim().min(1, "Elige un plan"),
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
      error: `No hay template activo para ${data.vertical}. Crea uno en /admin/plantillas.`,
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
    action: "saas.store_owner_transferred",
    actorId: guard.id,
    storeId: store.id,
    target: store.id,
    metadata: {
      slug: store.slug,
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

  // Si NO hay sesión válida de admin, no tiene sentido redirigir a una
  // ruta `/admin/*` (el layout volverá a `/login`). Mandamos directo a
  // `/login` y evitamos un paso intermedio confuso. El audit solo se
  // emite si hay sesión.
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) {
    redirect("/login");
  }

  if (storeId) {
    await audit({
      action: "saas.store_impersonation_ended",
      actorId: guard.id,
      target: storeId,
      metadata: {},
    });
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

// ============== Suspender / Reactivar tienda ==============
//
// Override manual del super admin. Para flujo automático por mora ver
// `lib/billing/syncStoreStatuses.ts` (cron que mueve PAST_DUE→SUSPENDED al
// vencer el grace period). Esta action es para casos OOB: cliente pidió
// pausa, fraude detectado, reactivar tras pago manual, etc.
//
// Transiciones permitidas:
//   ACTIVE | PAST_DUE | TRIAL   → SUSPENDED
//   SUSPENDED                    → ACTIVE (vuelve a flujo normal)
//   CANCELLED                    → ningún cambio (usar delete)

export type AdminToggleStoreStatusState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<"reason", string>>;
};

const toggleStatusSchema = z.object({
  storeId: z.string().min(1),
  action: z.enum(["suspend", "reactivate"]),
  // Razón opcional al suspender — queda en audit log para soporte.
  // Al reactivar no se pide.
  reason: z.string().trim().max(280).optional().default(""),
});

export async function adminToggleStoreStatusAction(
  _prev: AdminToggleStoreStatusState,
  formData: FormData,
): Promise<AdminToggleStoreStatusState> {
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) return { error: guard.error };

  const parsed = toggleStatusSchema.safeParse({
    storeId: formData.get("storeId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<"reason">(parsed.error),
    };
  }
  const { storeId, action, reason } = parsed.data;

  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { id: true, slug: true, status: true },
  });
  if (!store) return { error: "Tienda no encontrada" };

  if (action === "suspend") {
    if (store.status === StoreStatus.SUSPENDED) {
      return { error: "La tienda ya está suspendida." };
    }
    if (store.status === StoreStatus.CANCELLED) {
      return { error: "Tienda cancelada — usa eliminar en su lugar." };
    }
    if (!reason) {
      return { fieldErrors: { reason: "Escribe la razón de la suspensión." } };
    }

    // Suspender la tienda cancela los pedidos activos: el owner pierde
    // acceso al dashboard, así que dejar pedidos pendientes los condena
    // al limbo (cliente esperando + nadie procesando). Incluimos
    // PENDING_PAYMENT porque el stock ya está aplicado (orders.ts:664
    // siempre aplica stock al crear) y debe restaurarse, además el
    // cliente que subió comprobante merece un estado terminal.
    //
    // Pedidos IN_DELIVERY los dejamos vivos — están en mano del courier
    // y debe completarse o gestionarse externamente. DELIVERED ya está
    // cerrado.
    const cancelledOrders = await db.$transaction(async (tx) => {
      const targets = await tx.order.findMany({
        where: {
          storeId,
          status: { in: ["PENDING_PAYMENT", "NEW", "CONFIRMED", "PREPARING"] },
        },
        select: { id: true },
      });
      const cancelReason = `Tienda suspendida por administración: ${reason}`;
      const cancelledAt = new Date();
      for (const o of targets) {
        await tx.order.update({
          where: { id: o.id },
          data: {
            status: "CANCELLED",
            cancelReason,
            cancelledAt,
          },
        });
        // OrderEvent para que el cliente y el audit trail vean el motivo.
        await tx.orderEvent.create({
          data: {
            orderId: o.id,
            type: "STATUS_CANCELLED",
            description: cancelReason,
            byUserId: guard.id,
            byUserName: "Administración",
          },
        });
        // revertOrderImpact restituye stock, decrementa contadores del
        // customer e incrementa el counter del cupón. Idempotente:
        // verifica `stockApplied` antes de tocar nada.
        await revertOrderImpact(tx, o.id);
      }
      await tx.store.update({
        where: { id: storeId },
        data: { status: StoreStatus.SUSPENDED },
      });
      return targets.length;
    });

    await audit({
      action: "saas.store_suspended",
      actorId: guard.id,
      target: storeId,
      metadata: {
        slug: store.slug,
        previousStatus: store.status,
        reason,
        manualOverride: true,
        cancelledOrders,
      },
    });
  } else {
    if (store.status === StoreStatus.ACTIVE) {
      return { error: "La tienda ya está activa." };
    }
    if (store.status === StoreStatus.CANCELLED) {
      return { error: "Tienda cancelada — no se puede reactivar." };
    }

    // updateMany con guard atómico: si entre el findUnique y este update
    // otro admin (o el cron) ya cambió el estado, abortamos sin sobreescribir.
    // Limpiamos `suspendedAt/suspendedReason` para mantener consistencia
    // con los otros caminos de reactivación (syncStoreStatuses, verify
    // invoice payment, cancel invoice).
    const reactivated = await db.store.updateMany({
      where: {
        id: storeId,
        status: { in: ["PAST_DUE", "SUSPENDED", "TRIAL"] },
      },
      data: {
        status: StoreStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    if (reactivated.count === 0) {
      return { error: "El estado de la tienda cambió. Recarga la página." };
    }

    await audit({
      action: "saas.store_reactivated",
      actorId: guard.id,
      target: storeId,
      metadata: {
        slug: store.slug,
        previousStatus: store.status,
        manualOverride: true,
      },
    });
  }

  // Storefront + listing públicos refrescan. El dashboard del owner
  // también, porque ahí mostramos el badge de estado.
  revalidatePath(`/admin/tiendas/${storeId}`);
  revalidatePath("/admin/tiendas");
  revalidatePath("/tiendas");
  revalidatePath(`/${store.slug}`);
  return { ok: true };
}

// ============== Eliminar tienda (HARD DELETE) ==============
//
// Destructivo e irreversible. Borra la tienda + TODOS sus datos relacionados
// + sus imágenes en Vercel Blob (o filesystem en dev).
//
// Lo que se elimina:
//   - Orders + items, events, payments, couponUsages (cascade vía Order)
//   - Invoices (FK Restrict, deleteMany manual)
//   - StoreOrderCounter (sin FK relation declarada, deleteMany manual)
//   - Vía cascade del Store.delete:
//     products, categories, productImages, productAvailability, hours,
//     coupons, banners, popups, deliveryZones, customers, pageViews
//   - User STORE_OWNER queda con storeId=null (SetNull) — los deshabilitamos
//     antes para evitar ventana de login válido.
//   - Imágenes en Blob bajo `uploads/<storeId>/` y `proof/<storeId>/`
//   - Audit logs quedan con storeId=null (SetNull) — preservamos para
//     trazabilidad histórica del super admin.
//
// Para confirmar, el admin tiene que escribir el slug EXACTO en el form.

export type AdminDeleteStoreState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<"confirmSlug", string>>;
};

const deleteStoreSchema = z.object({
  storeId: z.string().min(1),
  confirmSlug: z.string().trim().min(1),
});

/**
 * Borra todos los blobs bajo dos prefijos del storeId. Best-effort:
 * loguea errores pero no falla la operación principal — si la DB ya borró
 * los registros, no podemos "rollback" el delete. Mejor dejar blobs
 * huérfanos (que luego un cron puede limpiar) que dejar la tienda
 * a medio-borrar.
 *
 * En dev sin BLOB_READ_WRITE_TOKEN: usa fs.rm sobre los directorios locales.
 */
async function purgeStorageForStore(storeId: string): Promise<{
  deletedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let deletedCount = 0;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    for (const prefix of [`uploads/${storeId}/`, `proof/${storeId}/`]) {
      // `list()` pagina implícitamente — para tiendas grandes podríamos
      // tener cientos de blobs. Iteramos con cursor hasta vaciar el prefix.
      let cursor: string | undefined = undefined;
      do {
        try {
          // Anotación explícita: sin esto TS no puede inferir `result`
          // por la recursión cursor→result.cursor→cursor del do-while.
          const result: ListBlobResult = await list({ prefix, cursor, limit: 1000 });
          if (result.blobs.length > 0) {
            await del(result.blobs.map((b) => b.url));
            deletedCount += result.blobs.length;
          }
          cursor = result.hasMore ? result.cursor : undefined;
        } catch (err) {
          errors.push(`blob ${prefix}: ${(err as Error).message}`);
          cursor = undefined; // abortar el prefix con error
        }
      } while (cursor);
    }
  } else {
    // Filesystem fallback (dev local). Borrar los dos directorios.
    const publicDir = path.join(
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"),
      storeId,
    );
    const privateDir = path.join(proofUploadDir(), storeId);
    for (const dir of [publicDir, privateDir]) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (err) {
        errors.push(`fs ${dir}: ${(err as Error).message}`);
      }
    }
  }

  return { deletedCount, errors };
}

export async function adminDeleteStoreAction(
  _prev: AdminDeleteStoreState,
  formData: FormData,
): Promise<AdminDeleteStoreState> {
  const guard = await requireSuperAdminOrFail();
  if ("error" in guard) return { error: guard.error };

  const parsed = deleteStoreSchema.safeParse({
    storeId: formData.get("storeId"),
    confirmSlug: formData.get("confirmSlug"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: { confirmSlug: "Confirmación inválida." },
    };
  }
  const { storeId, confirmSlug } = parsed.data;

  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      _count: {
        select: {
          orders: true,
          products: true,
          customers: true,
          invoices: true,
        },
      },
    },
  });
  if (!store) return { error: "Tienda no encontrada" };

  // Confirmación: el slug típeado debe matchear EXACTO (case-sensitive). Es
  // el patrón GitHub/Linear — fuerza al admin a leer + escribir el nombre,
  // imposible borrar "por accidente" al confundir un dropdown.
  if (confirmSlug !== store.slug) {
    return {
      fieldErrors: {
        confirmSlug: `Escribe "${store.slug}" exacto para confirmar.`,
      },
    };
  }

  // Snapshot para audit log antes de borrar la DB.
  const snapshot = {
    slug: store.slug,
    name: store.name,
    status: store.status,
    orderCount: store._count.orders,
    productCount: store._count.products,
    customerCount: store._count.customers,
    invoiceCount: store._count.invoices,
  };

  try {
    await db.$transaction(async (tx) => {
      // 1. Deshabilitar TODOS los usuarios de la tienda (owners Y cashiers)
      //    ANTES de tocar la store — evita la ventana en la que un user
      //    pueda loguear con storeId nullified pero todavía activo. Sin
      //    incluir a los cashiers, un cashier con JWT vivo (window de
      //    revalidación de 60s) puede seguir accionando contra una tienda
      //    que ya no existe.
      await tx.user.updateMany({
        where: { storeId, isActive: true },
        data: { isActive: false },
      });

      // 2. Tablas con FK Restrict → deleteMany manual previo al store.delete.
      //    Order.deleteMany ya cascade-borra OrderItem, OrderEvent, Payment,
      //    CouponUsage (todos tienen onDelete: Cascade vs Order).
      await tx.order.deleteMany({ where: { storeId } });
      await tx.invoice.deleteMany({ where: { storeId } });

      // 3. Counter por tienda sin FK relation declarada — borrarlo a mano.
      await tx.storeOrderCounter.deleteMany({ where: { storeId } });

      // 4. Store delete → cascade del resto (products, categories,
      //    productImages, storeHours, coupons, banners, popups,
      //    deliveryZones, customers, pageViews).
      await tx.store.delete({ where: { id: storeId } });
    });
  } catch (err) {
    // Si el delete falla, la DB queda intacta y el admin puede reintentar.
    // No tocamos blobs todavía — solo después del commit exitoso.
    captureError(err, { action: "admin-stores.deleteStore", storeId });
    return { error: "No pudimos eliminar la tienda. Revisa los logs del servidor." };
  }

  // Post-tx: cleanup de storage. Best-effort — si falla loguea pero no
  // revierte el delete (sería imposible recrear toda la DB de la tienda).
  const storage = await purgeStorageForStore(storeId);

  // Limpiar cookie de impersonation si el admin estaba "configurando" la
  // tienda recién borrada. Sin esto, su próximo /dashboard reventaría
  // intentando resolver una store que ya no existe.
  const impersonating = await readImpersonatedStoreId();
  if (impersonating === storeId) {
    await clearImpersonatedStore();
  }

  await audit({
    action: "saas.store_deleted",
    actorId: guard.id,
    target: storeId,
    metadata: {
      ...snapshot,
      blobsDeleted: storage.deletedCount,
      storageErrors: storage.errors,
    },
  });

  revalidatePath("/admin/tiendas");
  revalidatePath("/tiendas");
  // El detail page no existe más — redirigimos al listado.
  redirect("/admin/tiendas");
}
