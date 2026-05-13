/**
 * Sentry — config del Node runtime (Server Components, Route Handlers, Server Actions).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Server: 1.0 — cuando un server action falla queremos verlo siempre.
    // Si la cuota gratis (5k/mes) se vuelve un problema, bajamos.
    sampleRate: 1.0,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

    // No queremos reportar redirects de NextAuth como errores
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],

    // Filtrar info sensible antes de mandar.
    beforeSend(event) {
      // Headers que pueden tener tokens/cookies.
      if (event.request?.headers) {
        delete event.request.headers["cookie"];
        delete event.request.headers["authorization"];
        delete event.request.headers["set-cookie"];
        delete event.request.headers["x-api-key"];
      }
      // Body de server actions: contiene FormData con password, paymentProofUrl,
      // datos del cliente. NUNCA debe salir hacia Sentry.
      if (event.request) {
        event.request.data = "[Filtered]";
      }
      // Query params: pueden tener tokens en URLs (?token=...).
      if (event.request?.query_string) {
        event.request.query_string = "[Filtered]";
      }
      // `abs_path` en stack frames revela el path absoluto del filesystem en
      // el server (ej. /vercel/path0/... o /home/user/...). Sentry de todos
      // modos lo agrupa por module/filename, así que el abs_path solo aporta
      // info que el atacante podría usar si Sentry leakea.
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.stacktrace?.frames) {
            for (const frame of ex.stacktrace.frames) {
              if (frame.abs_path) frame.abs_path = "[Filtered]";
            }
          }
        }
      }
      return event;
    },
  });
}
