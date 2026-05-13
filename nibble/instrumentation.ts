/**
 * Next.js instrumentation hook — registrado automáticamente al boot.
 *
 * Carga la config de Sentry según el runtime. Sin DSN, los archivos
 * sentry.*.config.ts no hacen nada (early return).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Hook para errores no capturados en RSC / route handlers
export { captureRequestError as onRequestError } from "@sentry/nextjs";
