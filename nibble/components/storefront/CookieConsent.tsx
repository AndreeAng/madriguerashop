"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  acceptCookiesAction,
  rejectCookiesAction,
} from "@/server/actions/consent";

/**
 * Banner de consentimiento de cookies analíticas.
 *
 * Aparece la primera vez que el visitante carga el storefront (mientras la
 * cookie `mv_consent` no exista) y desaparece al elegir. El middleware
 * inicializa `mv_visitor`/`mv_session` solo después de "Aceptar".
 *
 * No mostramos modal bloqueante — banner fijo abajo. Es ruido moderado vs
 * la ley boliviana 164 que pide consentimiento claro pero no fuerza
 * pop-ups intrusivos como GDPR estricto.
 */
export function CookieConsent() {
  // Estado inicial conservador: no mostramos hasta confirmar que la cookie
  // no existe en el cliente. SSR no puede saberlo (la cookie es del
  // browser), así que esperamos al primer effect en el cliente.
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Solo cookies "no httpOnly" son visibles desde document.cookie. La
    // cookie de consent fue diseñada explícitamente sin httpOnly para
    // que este check funcione.
    const hasConsent = document.cookie
      .split("; ")
      .some((c) => c.startsWith("mv_consent="));
    if (!hasConsent) setVisible(true);
  }, []);

  function handle(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      setVisible(false);
    });
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3 shadow-float"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm text-[color:var(--fg-soft)]">
          Usamos cookies analíticas para medir tráfico y mejorar el sitio.
          Solo se activan si aceptas.{" "}
          <Link
            href="/privacidad"
            className="font-medium text-[color:var(--fg)] underline"
          >
            Más info
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handle(rejectCookiesAction)}
            className="rounded-full border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-4 py-2 text-sm font-medium text-[color:var(--fg)] hover:bg-[color:var(--card)] disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handle(acceptCookiesAction)}
            className="rounded-full bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)] disabled:opacity-50"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
