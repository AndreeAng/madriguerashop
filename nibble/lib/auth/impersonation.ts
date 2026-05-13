import "server-only";
import { cookies } from "next/headers";
import { IMPERSONATION_COOKIE_NAME as COOKIE_NAME_SHARED } from "./impersonation-shared";

/**
 * Cookie de "shadow login": permite que un SUPER_ADMIN entre al dashboard
 * de una tienda específica como si fuera su owner, sin crear un User
 * fantasma. Útil para configurar tiendas demo antes de asignarles dueño.
 *
 * - `httpOnly: true` → JS del cliente no la lee (defensa en profundidad).
 * - `sameSite: "lax"` → no se manda en navegaciones cross-site sospechosas.
 * - `maxAge: 4h` → vida máxima acotada. Antes la cookie era "de sesión"
 *   (sin maxAge) pero los browsers modernos restauran sesiones al reabrir,
 *   dejándola viva días. Si un admin entra a una tienda y cierra el laptop,
 *   la cookie podía sobrevivir indefinidamente. 4h alcanza para configurar
 *   una tienda demo y se re-ingresa al volver del almuerzo.
 *
 * El valor es el `storeId` plain (CUID). No firmamos ni cifrámos porque:
 *  1. La cookie es httpOnly (solo nuestro server la setea/lee).
 *  2. En cada uso revalidamos contra DB que (a) la store existe, (b) el
 *     caller es SUPER_ADMIN. Si alguien la fabrica, no logra nada.
 */
const COOKIE_NAME = COOKIE_NAME_SHARED;
const IMPERSONATION_MAX_AGE_S = 60 * 60 * 4; // 4 horas

export async function setImpersonatedStore(storeId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: IMPERSONATION_MAX_AGE_S,
  });
}

export async function clearImpersonatedStore(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function readImpersonatedStoreId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value ?? null;
}

// El nombre de la cookie se exporta desde `./impersonation-shared` (módulo
// neutro, sin "server-only") para que Edge/middleware pueda importarlo.
// Re-exportamos acá para compatibilidad si algún Node import lo busca acá.
export { IMPERSONATION_COOKIE_NAME } from "./impersonation-shared";
