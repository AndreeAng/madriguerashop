"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

const MAX_RESET_ATTEMPTS = 3;

/**
 * Boundary global de errores. Next.js renderiza esto cuando una página/layout
 * lanza una excepción no manejada en server o client.
 *
 * El `reset()` reintenta el render del segmento — útil para errores
 * transitorios (DB lenta, red intermitente). Si el error es permanente
 * (config rota, env faltante) reset loopea contra el mismo error, así que
 * limitamos los reintentos a `MAX_RESET_ATTEMPTS` y después escondemos el
 * botón — el usuario solo puede salir hacia "/" o cerrar pestaña.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [attempts, setAttempts] = useState(0);
  const lastDigestRef = useRef<string | undefined>(error.digest);

  // Si el error cambió (diferente digest), reset attempts — es un error
  // distinto, no un loop.
  useEffect(() => {
    if (error.digest !== lastDigestRef.current) {
      lastDigestRef.current = error.digest;
      setAttempts(0);
    }
  }, [error.digest]);

  useEffect(() => {
    // Sentry captura automáticamente errores no manejados del runtime,
    // pero los que llegan a este error boundary ya fueron envueltos por
    // Next.js — necesitamos reportarlos explícitamente para que aparezcan
    // con el contexto del boundary (route, digest). Sentry hace early
    // return si no hay DSN configurado.
    Sentry.captureException(error, {
      tags: { boundary: "app/error", digest: error.digest ?? "none" },
    });
    console.error("[app/error]", error);
  }, [error]);

  const canRetry = attempts < MAX_RESET_ATTEMPTS;
  const handleRetry = () => {
    setAttempts((n) => n + 1);
    reset();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[color:var(--bg)] p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-[color:var(--color-tomato-500)]/10 text-[color:var(--color-tomato-600)]">
          <AlertTriangle className="size-6" />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Algo se rompió
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight">
          No pudimos cargar esta página
        </h1>
        <p className="mt-4 text-[color:var(--muted)]">
          Ya estamos viendo qué pasó. Si el problema sigue, escríbenos al
          WhatsApp de soporte.
        </p>

        {error.digest && (
          <p className="mt-4 inline-block rounded-lg bg-[color:var(--card)] px-3 py-1.5 font-mono text-[11px] text-[color:var(--muted)]">
            ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-bark-900)] px-5 py-3 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
            >
              <RefreshCw className="size-4" />
              Reintentar
            </button>
          )}
          <Link
            href="/"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] hover:underline"
          >
            Volver al inicio
          </Link>
        </div>
        {!canRetry && (
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            Probamos varias veces sin éxito. Vuelve al inicio o escríbenos.
          </p>
        )}
      </div>
    </main>
  );
}
