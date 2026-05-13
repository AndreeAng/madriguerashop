import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readImpersonatedStoreId } from "@/lib/auth/impersonation";
import { Role, type Store, type User } from "@prisma/client";

/**
 * Si el caller es SUPER_ADMIN y tiene una cookie de impersonation válida,
 * devuelve esa tienda. Sin la cookie o si la tienda no existe, devuelve null
 * y el caller sigue el flow normal.
 *
 * Centralizado para que `requireStoreOwner` y `requireOwnerOnly` tengan
 * exactamente el mismo comportamiento — discrepancias acá causan bugs sutiles
 * (admin entra a /dashboard/pedidos pero no a /dashboard/productos, etc.).
 */
async function resolveImpersonatedStore(
  role: string,
): Promise<Store | null> {
  if (role !== Role.SUPER_ADMIN) return null;
  const storeId = await readImpersonatedStoreId();
  if (!storeId) return null;
  return db.store.findUnique({ where: { id: storeId } });
}

/**
 * Guard inverso: redirige al panel apropiado si ya hay sesión. Para usar
 * en /login, /registro, /recovery, /recovery/[token] — antes ese bloque
 * vivía duplicado en las 4 páginas.
 */
export async function requireGuest(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const role = session.user.role;
  if (role === Role.SUPER_ADMIN) redirect("/admin");
  if (role === Role.STORE_OWNER || role === Role.CASHIER) redirect("/dashboard");
  // CUSTOMER (compradores) no tienen panel — los devolvemos a su storefront
  // de origen si existe, sino al directorio. Sin esto un CUSTOMER que entra
  // a /login era redirigido a /dashboard, donde requireStoreOwner lo expulsa
  // a /login otra vez → loop.
  redirect("/tiendas");
}

/**
 * Recupera la sesión y exige que sea STORE_OWNER (o SUPER_ADMIN actuando sobre su tienda).
 * Carga la store completa.
 *
 * Uso típico:
 *   const { user, store } = await requireStoreOwner();
 *
 * Comportamiento:
 *  - Sin sesión → redirige a /login
 *  - Sin storeId asociado → redirige a /registro (no debería pasar normalmente)
 *  - Store no encontrada → 500 (es bug nuestro)
 */
export async function requireStoreOwner(): Promise<{
  user: {
    id: string;
    role: string;
    storeId: string;
    name: string | null;
    email: string | null;
  };
  store: Store;
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== Role.STORE_OWNER && role !== Role.CASHIER && role !== Role.SUPER_ADMIN) {
    redirect("/login");
  }

  // Camino "shadow login": super admin con cookie de impersonation entra a
  // configurar una tienda específica como si fuera su owner.
  const impersonated = await resolveImpersonatedStore(role);
  if (impersonated) {
    return {
      user: {
        id: session.user.id,
        role,
        storeId: impersonated.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
      },
      store: impersonated,
    };
  }

  const storeId = session.user.storeId;
  if (!storeId) {
    // STORE_OWNER sin tienda no debería existir (lo creamos juntos en registro).
    // SUPER_ADMIN sin cookie de impersonation tampoco tiene tienda asignada;
    // lo mandamos al panel admin (no a /registro que es para clientes).
    if (role === Role.SUPER_ADMIN) redirect("/admin/tiendas");
    redirect("/registro");
  }

  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) {
    throw new Error(
      `Store ${storeId} not found for user ${session.user.id}. Inconsistent state.`,
    );
  }

  return {
    user: {
      id: session.user.id,
      role,
      storeId,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    },
    store,
  };
}

/**
 * Variante que sólo retorna IDs sin la store completa.
 * Útil para actions que sólo necesitan validar autorización antes de un update.
 */
export async function requireStoreOwnerIds(): Promise<{
  userId: string;
  storeId: string;
  role: User["role"];
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== Role.STORE_OWNER && role !== Role.CASHIER && role !== Role.SUPER_ADMIN) {
    redirect("/login");
  }

  // Shadow login (super admin configurando una tienda demo).
  const impersonated = await resolveImpersonatedStore(role);
  if (impersonated) {
    return { userId: session.user.id, storeId: impersonated.id, role };
  }

  const storeId = session.user.storeId;
  if (!storeId) {
    if (role === Role.SUPER_ADMIN) redirect("/admin/tiendas");
    redirect("/registro");
  }

  return { userId: session.user.id, storeId, role };
}

/**
 * Como `requireStoreOwner` pero EXCLUYE el rol CASHIER. Usar para acciones que
 * sólo el dueño debe poder hacer: settings, alta/baja de productos y
 * categorías, facturación SaaS, etc. CASHIER es un rol operativo de pedidos.
 */
export async function requireOwnerOnly(): Promise<{
  user: { id: string; role: string; storeId: string };
  store: Store;
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== Role.STORE_OWNER && role !== Role.SUPER_ADMIN) {
    redirect("/dashboard");
  }

  const impersonated = await resolveImpersonatedStore(role);
  if (impersonated) {
    return {
      user: { id: session.user.id, role, storeId: impersonated.id },
      store: impersonated,
    };
  }

  const storeId = session.user.storeId;
  if (!storeId) {
    if (role === Role.SUPER_ADMIN) redirect("/admin/tiendas");
    redirect("/registro");
  }

  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store) {
    throw new Error(
      `Store ${storeId} not found for user ${session.user.id}. Inconsistent state.`,
    );
  }

  return { user: { id: session.user.id, role, storeId }, store };
}

/** Variante de `requireOwnerOnly` que sólo retorna IDs. */
export async function requireOwnerOnlyIds(): Promise<{
  userId: string;
  storeId: string;
  role: User["role"];
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== Role.STORE_OWNER && role !== Role.SUPER_ADMIN) {
    redirect("/dashboard");
  }

  const impersonated = await resolveImpersonatedStore(role);
  if (impersonated) {
    return { userId: session.user.id, storeId: impersonated.id, role };
  }

  const storeId = session.user.storeId;
  if (!storeId) {
    if (role === Role.SUPER_ADMIN) redirect("/admin/tiendas");
    redirect("/registro");
  }

  return { userId: session.user.id, storeId, role };
}

/**
 * Exige que el usuario sea SUPER_ADMIN activo. Redirige a /login si no.
 * Retorna info básica del admin para usar en el layout.
 *
 * El check de `isActive` en DB es defensa en profundidad: el JWT también lo
 * revalida (ver auth.ts), pero acá lo verificamos contra el estado actual.
 */
export async function requireSuperAdmin(): Promise<{
  userId: string;
  email: string | null;
  fullName: string | null;
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.SUPER_ADMIN) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { fullName: true, isActive: true },
  });
  if (!user?.isActive) redirect("/login");

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    fullName: user.fullName ?? null,
  };
}

/**
 * Variante para server actions: retorna `{ error }` en lugar de redirigir
 * (las actions tienen que devolver `ActionState`, no pueden hacer redirect
 * a una página HTML desde un POST).
 *
 * `errorMessage` permite personalizar el feedback al admin por dominio
 * (ej. "Sólo el super admin puede gestionar usuarios").
 */
export async function requireSuperAdminOrFail(
  errorMessage = "Sólo el super admin puede ejecutar esta acción.",
): Promise<{ id: string } | { error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.SUPER_ADMIN) {
    return { error: errorMessage };
  }
  // Defensa en profundidad: aunque el JWT diga SUPER_ADMIN, si el usuario fue
  // desactivado después de emitir el token, no debe poder ejecutar acciones
  // hasta que la próxima revalidación del JWT lo expulse.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user?.isActive) {
    return { error: errorMessage };
  }
  return { id: session.user.id };
}
