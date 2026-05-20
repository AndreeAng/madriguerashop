import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * `remotePatterns` para `next/image`. Lo armamos dinámicamente desde
 * `PUBLIC_UPLOADS_URL` para evitar tener que hardcodear el host de producción
 * en código. En dev (URL relativa `/uploads`) no se agrega nada — Next sirve
 * `public/uploads/*` directamente como rutas same-origin.
 *
 * Unsplash/Picsum se mantienen SOLO en development como placeholders del seed.
 */
function buildRemotePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

  const uploadsUrl = process.env.PUBLIC_UPLOADS_URL;
  if (uploadsUrl) {
    try {
      const u = new URL(uploadsUrl);
      // Solo agregar si es absoluto (no `/uploads`). Same-origin no necesita patrón.
      if (u.protocol === "https:" || u.protocol === "http:") {
        patterns.push({
          protocol: u.protocol.replace(":", "") as "http" | "https",
          hostname: u.hostname,
          ...(u.port ? { port: u.port } : {}),
          pathname: u.pathname === "/" ? "/**" : `${u.pathname.replace(/\/$/, "")}/**`,
        });
      }
    } catch {
      // PUBLIC_UPLOADS_URL no es URL válida — ignorar silenciosamente.
    }
  }

  // Vercel Blob: cuando hay token, `saveImage` guarda en Blob y devuelve
  // URLs `https://<id>.public.blob.vercel-storage.com/...`. Sin este
  // patrón, `next/image` rechazaría la URL con "hostname not configured".
  // El wildcard `**.public.blob.vercel-storage.com` cubre cualquier project
  // store-id (no necesitamos hardcodear el ID por proyecto).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    patterns.push({
      protocol: "https",
      hostname: "**.public.blob.vercel-storage.com",
    });
  }

  // Placeholders del seed (Unsplash/Picsum) sólo en dev. En producción no
  // deberían aparecer URLs así — si aparecen es bug del seed que se debe
  // corregir, no algo que la app deba "soportar" sirviendo.
  if (process.env.NODE_ENV !== "production") {
    patterns.push(
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    );
  }

  return patterns;
}

// NOTA: Content-Security-Policy se genera en `middleware.ts` con un
// nonce por request (CSP estricta con `'nonce-XXX' 'strict-dynamic'`).
// Antes vivía acá con `'unsafe-inline'` — esa concesión la removió el
// refactor a nonce-based. Los otros headers de seguridad (HSTS,
// X-Frame-Options, Referrer-Policy, Permissions-Policy) viven en
// `vercel.json` porque son estáticos y no dependen de runtime.

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
  },
};

// `withSentryConfig` inyecta el Sentry webpack plugin que sube source maps
// en build y tunneliza eventos para esquivar ad-blockers. Sin este wrapper
// los stack traces de producción quedan minificados e inútiles para debug.
//
// `SENTRY_AUTH_TOKEN` se setea solo en CI/Vercel (NUNCA en el repo). Sin
// token, Sentry omite el upload de source maps pero no rompe el build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Tunneliza eventos de Sentry a través de un endpoint del propio dominio
  // para evitar ad-blockers que filtran ingest.sentry.io. La ruta se
  // genera automáticamente por @sentry/nextjs.
  tunnelRoute: "/monitoring",
  // Configura el plugin de webpack que sube source maps y luego los oculta
  // del bundle público; valores default funcionan bien para Vercel.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
});
