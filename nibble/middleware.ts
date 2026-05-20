import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
// IMPORTANTE: usamos `auth.config.ts` (Edge-safe) y NO `auth.ts` completo.
// El módulo `auth.ts` arrastra Prisma vía el callback `jwt`, y Prisma no
// corre en Edge Runtime (binary engines). Si el middleware importa
// `auth.ts`, cada request del middleware revienta con "PrismaClient is
// unable to run in this browser environment".
//
// Web Crypto (`globalThis.crypto`) está disponible en Edge Runtime y trae
// `randomUUID()` desde V8 19+. Importar `node:crypto` rompe el bundle de
// middleware porque Edge no expone APIs de Node.
const { auth } = NextAuth(authConfig);

const VISITOR_COOKIE = "mv_visitor";
const CONSENT_COOKIE = "mv_consent";
const SESSION_COOKIE = "mv_session";
const VISITOR_TTL_S = 60 * 60 * 24 * 180; // 6 meses
const SESSION_TTL_S = 60 * 30; // 30 min sliding

// ============== CSP con nonce por request ==============
//
// El CSP estricto bloquea scripts inline a menos que tengan el nonce
// generado por request. Sin esto teníamos `'unsafe-inline'` en script-src,
// lo que dejaba la puerta abierta a XSS reflejado.
//
// Cómo funciona:
//   1. Generamos un nonce fresh por request (crypto.randomUUID en Edge).
//   2. Lo inyectamos en CSP: `script-src 'self' 'nonce-XXX' 'strict-dynamic'`.
//   3. Lo seteamos en `x-nonce` request header → Next lo lee y lo aplica
//      automáticamente a sus inline scripts (hidratación, RSC chunks).
//   4. Para scripts custom (ej. `<script src="/unregister-sw.js" />` en
//      RootLayout), el layout lee el nonce via `headers()` y lo pasa
//      explícito al `<script>` tag.
//
// `'strict-dynamic'`: si un script con nonce carga otros scripts (ej.
// webpack chunks de Next), esos heredan el trust del padre — sin esto
// los chunks dinámicos fallarían a cargar bajo CSP estricto.
//
// `style-src` se mantiene con `'unsafe-inline'` porque Tailwind v4 y
// next/font inyectan CSS inline. Migrar style a nonces requiere
// refactor mayor — fuera de scope.

function imgSrcSources(): string {
  const sources = ["'self'", "data:", "blob:"];
  if (process.env.PUBLIC_UPLOADS_URL) {
    try {
      const u = new URL(process.env.PUBLIC_UPLOADS_URL);
      sources.push(`${u.protocol}//${u.host}`);
    } catch {
      // ignored — URL mal formateada
    }
  }
  // Vercel Blob — cuando guardamos uploads ahí, las URLs son
  // https://<id>.public.blob.vercel-storage.com/... y el browser necesita
  // permiso CSP para cargarlas. Lo agregamos siempre que haya token (es la
  // señal de que `saveImage` está escribiendo a Blob). En dev sin token,
  // no contamina la CSP con un dominio que no se usa.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    sources.push("https://*.public.blob.vercel-storage.com");
  }
  if (process.env.NODE_ENV !== "production") {
    sources.push("https://images.unsplash.com", "https://picsum.photos");
  }
  return sources.join(" ");
}

function buildCsp(nonce: string): string {
  // El tunnelRoute de Sentry (`/monitoring`) envía la mayoría de eventos
  // a través de same-origin, pero Replay y el envelope inicial pueden
  // golpear *.ingest.sentry.io directamente. Sin estos hosts en
  // connect-src, los errores de cliente se pierden silenciosamente.
  const connectSrc = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? "'self' https://*.ingest.sentry.io https://*.sentry.io"
    : "'self'";
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src": "'self' https://fonts.gstatic.com data:",
    "img-src": imgSrcSources(),
    "connect-src": connectSrc,
    "frame-ancestors": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "object-src": "'none'",
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  if (process.env.NODE_ENV === "production") {
    parts.push("upgrade-insecure-requests");
  }
  return parts.join("; ");
}

export default auth((req) => {
  // El callback `authorized` en auth.ts ya maneja la redirección.
  // Si no autorizado en /admin o /dashboard, NextAuth redirige a /login automáticamente.

  // CSP nonce por request — debe generarse ANTES del NextResponse para
  // poder pasarlo via x-nonce a Next.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Inyectar nonce en request headers — Next lo lee internamente y lo
  // aplica a sus scripts. Server components también pueden leerlo via
  // `headers().get("x-nonce")` para scripts custom.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // CSP en response headers — esto es lo que el browser realmente lee.
  res.headers.set("Content-Security-Policy", csp);

  // Bootstrap de cookies de analytics SOLO si el visitante dio consent.
  // La cookie `mv_consent="yes"` la setea el `<CookieConsent>` banner del
  // storefront cuando el cliente acepta. Sin consentimiento explícito no
  // creamos visitor/session — alinea el comportamiento con la política de
  // privacidad publicada.
  const cookies = req.cookies;
  const hasConsent = cookies.get(CONSENT_COOKIE)?.value === "yes";

  if (hasConsent) {
    if (!cookies.get(VISITOR_COOKIE)?.value) {
      res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
        maxAge: VISITOR_TTL_S,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    // Sesión sliding: renovar cada hit para que 30 min sea "tiempo de
    // inactividad", no "tiempo desde primer pageview".
    const sessionToken = cookies.get(SESSION_COOKIE)?.value ?? crypto.randomUUID();
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      maxAge: SESSION_TTL_S,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
});

export const config = {
  // Aplica a todo EXCEPTO archivos estáticos, _next, api/auth (que se maneja
  // solo), api/health (no necesita sesión y debe responder rápido al monitor)
  // y api/cron (autentica con bearer propio).
  matcher: [
    "/((?!api/auth|api/health|api/cron|_next/static|_next/image|favicon.ico|icon.svg|uploads|.*\\..*).*)",
  ],
};
