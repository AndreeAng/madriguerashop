import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Captura de errores. Si SENTRY_DSN está seteado, va a Sentry; si no,
 * cae a console.error con metadata.
 *
 * El SDK de Sentry hace early-return cuando no hay DSN — es seguro llamarlo
 * siempre.
 *
 * Uso:
 *   try { ... } catch (err) {
 *     captureError(err, { action: "createOrder", storeId });
 *     return { error: "Algo falló — ya estamos viendo." };
 *   }
 */

export type ErrorContext = Record<string, unknown>;

export function captureError(error: unknown, context?: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Logging local — siempre. Sirve incluso con Sentry activo.
  console.error("[captureError]", { message, stack, ...context });

  // Promovemos campos clave a TAGS (indexados, searchables en Sentry UI)
  // en lugar de `extras` (no indexados). Sin esto era imposible filtrar
  // errores por tenant en el dashboard de Sentry.
  const INDEXED_KEYS = new Set([
    "storeId",
    "actorId",
    "action",
    "tenantSlug",
    "route",
  ]);

  // Sentry (no-op si no hay DSN)
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        if (INDEXED_KEYS.has(k) && (typeof v === "string" || typeof v === "number")) {
          scope.setTag(k, String(v));
        } else {
          scope.setExtra(k, v);
        }
      }
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(message, "error");
    }
  });
}

