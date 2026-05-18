"use server";

import { auth, signOut } from "@/auth";
import {
  clearImpersonatedStore,
  readImpersonatedStoreId,
} from "@/lib/auth/impersonation";
import { audit } from "@/lib/audit/log";

/**
 * Server action que cierra la sesión y redirige a `/`. Se invoca desde
 * `<form action={signOutAction}>` en cualquier UI con sesión activa.
 *
 * NextAuth `signOut` borra la cookie del JWT y dispara un redirect — el
 * redirect propaga como `NEXT_REDIRECT` (no es error), por eso NO va
 * dentro de try-catch. Si lo capturas, la action retorna normal y la
 * cookie queda intacta.
 *
 * Limpiamos la cookie de impersonation ANTES del signOut: si un admin
 * estaba "shadow-logged" en una tienda y cerró sesión, la cookie no debe
 * sobrevivir al próximo usuario que use el mismo browser.
 *
 * Si había una impersonation activa, dejamos rastro en el audit log antes
 * de borrar la cookie — sin esto, un admin que entra a una tienda, mira
 * datos sensibles, y sale por "Cerrar sesión" (en lugar de "Salir de la
 * tienda") no aparecía en el trail forense.
 */
export async function signOutAction(): Promise<void> {
  const impersonatedStoreId = await readImpersonatedStoreId();
  if (impersonatedStoreId) {
    const session = await auth();
    await audit({
      action: "saas.store_impersonation_ended",
      actorId: session?.user?.id ?? null,
      target: impersonatedStoreId,
      metadata: { via: "signout" },
    });
  }
  await clearImpersonatedStore();
  await signOut({ redirectTo: "/" });
}
