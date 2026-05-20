/**
 * Sentry — config del Edge runtime (middleware, edge routes).
 *
 * Edge tiene API reducida vs. Node. Sentry edge sólo soporta lo básico.
 *
 * Antes este archivo no tenía `beforeSend` — un error en el middleware
 * (que corre en cada request autenticado) viajaba a Sentry con la cookie
 * de sesión completa y la URL del request (incluyendo paths sensibles
 * como `/verify-email/<token>` o `/orden/<token>`). Ese filtrado vivía
 * solo en `sentry.server.config.ts` y `sentry.client.config.ts` — el
 * edge se saltaba la capa de protección.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.APP_ENV ??
      process.env.NEXT_PUBLIC_APP_ENV ??
      process.env.NODE_ENV ??
      "unknown",
    // Edge corre el middleware de NextAuth — errores acá afectan a TODOS
    // los requests autenticados. Capturamos al 100%.
    sampleRate: 1.0,
    tracesSampleRate: 0,
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],

    // Mismo filtrado que server/client. Edge no tiene acceso a fs ni Buffer,
    // así que las operaciones son más simples — sólo borrar headers
    // sensibles y aplastar la URL. La función `scrubUrl` aplica el mismo
    // criterio que en `sentry.client.config.ts`.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["cookie"];
        delete event.request.headers["authorization"];
        delete event.request.headers["set-cookie"];
        delete event.request.headers["x-api-key"];
      }
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      if (event.request?.query_string) {
        event.request.query_string = "[Filtered]";
      }
      if (event.request) {
        event.request.data = "[Filtered]";
      }
      return event;
    },
  });
}

function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "http://placeholder");
    // Aplasta segmentos que parecen tokens (32+ hex/base64url) y rutas con
    // tokens conocidos (recovery, verify, magic-link, orden).
    if (/^\/(recovery|verify|magic-link|orden|verify-email)\//.test(u.pathname)) {
      u.pathname = u.pathname.split("/").slice(0, 2).join("/") + "/[Filtered]";
    }
    u.pathname = u.pathname.replace(/\/[A-Za-z0-9_-]{22,}/g, "/[Filtered]");
    const sensitive = ["token", "code", "password", "key", "secret"];
    for (const k of sensitive) {
      if (u.searchParams.has(k)) u.searchParams.set(k, "[Filtered]");
    }
    return u.pathname + (u.search || "");
  } catch {
    return "[Filtered]";
  }
}
