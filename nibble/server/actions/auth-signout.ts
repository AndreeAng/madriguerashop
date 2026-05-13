"use server";

import { signOut } from "@/auth";
import { clearImpersonatedStore } from "@/lib/auth/impersonation";

/**
 * Server action que cierra la sesión y redirige a `/`. Se invoca desde
 * `<form action={signOutAction}>` en cualquier UI con sesión activa.
 *
 * NextAuth `signOut` borra la cookie del JWT y dispara un redirect — el
 * redirect propaga como `NEXT_REDIRECT` (no es error), por eso NO va
 * dentro de try-catch. Si lo capturás, la action retorna normal y la
 * cookie queda intacta.
 *
 * Limpiamos la cookie de impersonation ANTES del signOut: si un admin
 * estaba "shadow-logged" en una tienda y cerró sesión, la cookie no debe
 * sobrevivir al próximo usuario que use el mismo browser.
 */
export async function signOutAction(): Promise<void> {
  await clearImpersonatedStore();
  await signOut({ redirectTo: "/" });
}
