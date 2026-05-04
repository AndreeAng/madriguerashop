import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Garantiza que un usuario tiene acceso a una tienda específica.
 * Política:
 *  - SUPER_ADMIN siempre puede.
 *  - STORE_OWNER y CASHIER solo a su propia tienda (User.storeId === storeId).
 *  - CUSTOMER nunca usa esto (acceso público vía storefront).
 *
 * Lanza Error si no tiene acceso. Llamala desde Server Actions.
 */
export async function assertCanAccessStore(
  userId: string,
  storeId: string,
): Promise<{ role: Role; storeId: string | null }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, storeId: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new Error("Unauthorized: usuario no encontrado o inactivo");
  }

  if (user.role === "SUPER_ADMIN") {
    return { role: user.role, storeId: user.storeId };
  }

  if ((user.role === "STORE_OWNER" || user.role === "CASHIER") && user.storeId === storeId) {
    return { role: user.role, storeId: user.storeId };
  }

  throw new Error("Forbidden: no tienes acceso a esta tienda");
}
