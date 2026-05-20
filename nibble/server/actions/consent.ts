"use server";

import { cookies } from "next/headers";

/**
 * Actions del banner de consentimiento de cookies analíticas.
 *
 * La cookie `mv_consent` puede tener tres estados:
 *   - "yes"  → el visitante aceptó, middleware bootstrappea visitor/session,
 *              `trackPageView` registra eventos.
 *   - "no"   → el visitante rechazó. No se trackea, no se genera token.
 *   - ausente → todavía no eligió. El banner está visible.
 *
 * La cookie dura 1 año para no spamear el banner. SameSite=lax para que
 * navegaciones desde otros dominios (Google, redes sociales) preserven la
 * decisión previa. No es HttpOnly porque el banner cliente necesita leerla
 * para decidir si renderizar.
 */

const CONSENT_COOKIE = "mv_consent";
const VISITOR_COOKIE = "mv_visitor";
const SESSION_COOKIE = "mv_session";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

async function setConsent(value: "yes" | "no"): Promise<void> {
  const store = await cookies();
  store.set(CONSENT_COOKIE, value, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
}

export async function acceptCookiesAction(): Promise<void> {
  await setConsent("yes");
}

export async function rejectCookiesAction(): Promise<void> {
  await setConsent("no");
  // Si el visitante rechaza pero ya tenía tokens (cookie aceptada en visita
  // previa y luego revocada vía /privacidad), borramos los rastros.
  const store = await cookies();
  store.delete(VISITOR_COOKIE);
  store.delete(SESSION_COOKIE);
}
