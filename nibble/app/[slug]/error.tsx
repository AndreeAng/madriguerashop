"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Error boundary del storefront. Reemplaza al `app/error.tsx` global cuando
 * algo falla dentro de `/[slug]/*`. La UX correcta acá es no asustar al
 * cliente: mostramos un mensaje suave y la opción de reintentar.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry ya captura desde el servidor; este log de cliente queda en consola.
    console.error("[storefront error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div className="text-center">
        <AlertCircle className="mx-auto size-10 text-[color:var(--color-tomato-600)]" />
        <h1 className="font-display mt-4 text-3xl">No pudimos cargar la tienda</h1>
        <p className="mt-2 max-w-md text-sm text-[color:var(--muted)]">
          Algo se rompió de nuestro lado mientras preparábamos esta página.
          Probá refrescar — y si sigue, contactá al dueño por WhatsApp.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="press inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-bark-900)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
          >
            <RefreshCw className="size-4" />
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-5 py-2.5 text-sm font-medium hover:bg-[color:var(--bg)]"
          >
            Ir al inicio
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-[11px] text-[color:var(--muted)]">
            Código: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
