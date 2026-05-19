import type { NextConfig } from "next";

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

export default nextConfig;
