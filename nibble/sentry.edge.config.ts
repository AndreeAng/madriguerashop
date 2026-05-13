/**
 * Sentry — config del Edge runtime (middleware, edge routes).
 *
 * Edge tiene API reducida vs. Node. Sentry edge sólo soporta lo básico.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Edge corre el middleware de NextAuth — errores acá afectan a TODOS
    // los requests autenticados. Capturamos al 100%.
    sampleRate: 1.0,
    tracesSampleRate: 0,
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],
  });
}
