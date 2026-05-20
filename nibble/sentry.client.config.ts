/**
 * Sentry — config del browser.
 *
 * Sólo se inicializa si SENTRY_DSN está seteado. En dev local sin DSN,
 * Sentry queda dormido y los errores caen al console.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // `NEXT_PUBLIC_APP_ENV` distingue staging de prod (en staging Vercel
    // setea NODE_ENV=production igual que en prod). Sin esto, errores de
    // staging contaminan las alertas de prod en Sentry.
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "unknown",

    // Sample rate de errores. 100% — un SaaS chico con pocos usuarios
    // no puede darse el lujo de perder 80% de errores. Si llegamos al
    // límite de cuota (5k/mes) bajamos esto a 0.5 y revisamos qué llena.
    sampleRate: 1.0,

    // Performance monitoring (transactions/spans). 0.1 = 10% para no llenar cuota free.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

    // Replays — útil para debug pero costoso. Sólo en errores en prod.
    replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0,
    replaysSessionSampleRate: 0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // No reportar errores de extensions, ni de canceled fetches del usuario.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /^AbortError/,
    ],

    // Scrub de info sensible del lado cliente. Mantiene paridad con server.config
    // y previene que un error que ocurre en /recovery/<token> mande el token
    // al servicio de Sentry.
    beforeSend(event) {
      // URL del request del browser puede contener tokens (?token=, /recovery/<token>).
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      if (event.request?.query_string) {
        event.request.query_string = "[Filtered]";
      }
      if (event.request) {
        // Form data y body de fetches — puede tener password, comprobantes, PII.
        event.request.data = "[Filtered]";
      }
      // Breadcrumbs de navigation guardan URLs visitadas — también pueden
      // tener tokens en el path.
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (crumb.data && typeof crumb.data.url === "string") {
            crumb.data.url = scrubUrl(crumb.data.url);
          }
          if (crumb.data && typeof crumb.data.to === "string") {
            crumb.data.to = scrubUrl(crumb.data.to);
          }
        }
      }
      return event;
    },
  });
}

/**
 * Sanea URLs antes de mandarlas a Sentry. Rutas que llevan tokens (recovery,
 * verify-email, magic-link) o query strings con tokens se aplastan al path
 * base — perdemos granularidad de la URL exacta pero ganamos no leakear
 * material de autenticación a un servicio externo.
 */
function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "http://placeholder");
    // Path: aplastar rutas con tokens en el path. `orden` y `verify-email`
    // se agregaron en Sprint 5 porque sus tokens son guessable únicamente
    // por entropía — si Sentry los recibe, alguien con acceso al dashboard
    // de Sentry puede ver pedidos/emails arbitrarios sin auth de la app.
    if (
      /^\/(recovery|verify|verify-email|magic-link|orden)\//.test(u.pathname)
    ) {
      u.pathname = u.pathname.split("/").slice(0, 2).join("/") + "/[Filtered]";
    }
    // Defensa genérica: cualquier segmento de path que parezca token
    // (22+ chars en base64url) se aplasta. `trackingToken` del Order
    // tiene 22 chars (16 bytes base64url) — cubierto.
    u.pathname = u.pathname.replace(/\/[A-Za-z0-9_-]{22,}/g, "/[Filtered]");
    // Query string: scrubear el valor de cualquier parámetro sospechoso.
    const sensitive = ["token", "code", "password", "key", "secret"];
    for (const k of sensitive) {
      if (u.searchParams.has(k)) u.searchParams.set(k, "[Filtered]");
    }
    return u.pathname + (u.search || "");
  } catch {
    return "[Filtered]";
  }
}
