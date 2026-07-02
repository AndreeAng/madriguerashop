"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

const MAX_RESET_ATTEMPTS = 3;

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [attempts, setAttempts] = useState(0);
  const lastDigestRef = useRef<string | undefined>(error.digest);

  useEffect(() => {
    if (error.digest !== lastDigestRef.current) {
      lastDigestRef.current = error.digest;
      setAttempts(0);
    }
  }, [error.digest]);

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "app/admin/error", digest: error.digest ?? "none" },
    });
    console.error("[admin/error]", error);
  }, [error]);

  const canRetry = attempts < MAX_RESET_ATTEMPTS;
  const handleRetry = () => {
    setAttempts((n) => n + 1);
    reset();
  };

  return (
    <main className="grid min-h-[60vh] place-items-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-[color:var(--color-tomato-500)]/10 text-[color:var(--color-tomato-600)]">
          <AlertTriangle className="size-6" />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Error en admin
        </p>
        <h1 className="font-display mt-3 text-3xl leading-tight">
          No pudimos cargar esta sección
        </h1>
        <p className="mt-4 text-[color:var(--muted)]">
          Ya quedó registrado en Sentry. Revisa los logs para más detalles.
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
            href="/admin"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] hover:underline"
          >
            Volver al admin
          </Link>
        </div>
        {!canRetry && (
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            Probamos varias veces sin éxito. Revisa los logs de Sentry.
          </p>
        )}
      </div>
    </main>
  );
}
