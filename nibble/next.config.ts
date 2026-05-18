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

/**
 * Content-Security-Policy. Mitiga XSS y data exfiltration: aunque un
 * atacante logre inyectar markup en la respuesta, el browser bloqueará
 * cargas de scripts/imágenes/etc. desde dominios no permitidos.
 *
 * Limitación aceptada hoy: incluimos `'unsafe-inline'` en `script-src`
 * porque Next 15 emite scripts inline pequeños para hidratación y RSC.
 * Eliminarlo requiere pattern nonce-based en middleware (refactor de
 * scope mayor — apropiado post-launch). El movimiento del unregister-sw
 * a `/public/unregister-sw.js` ya es parte de esa migración.
 *
 * `style-src 'unsafe-inline'`: Tailwind v4 y next/font inyectan CSS
 * inline en el `<head>`. Sin esto, los estilos se rompen visualmente.
 *
 * `img-src`: same-origin + data/blob (canvas/file previews) + el host
 * de uploads en prod + los placeholders de seed en dev.
 */
function imgSrcSources(): string {
  const sources = ["'self'", "data:", "blob:"];
  if (process.env.PUBLIC_UPLOADS_URL) {
    try {
      const u = new URL(process.env.PUBLIC_UPLOADS_URL);
      sources.push(`${u.protocol}//${u.host}`);
    } catch {
      // ignored
    }
  }
  if (process.env.NODE_ENV !== "production") {
    sources.push("https://images.unsplash.com", "https://picsum.photos");
  }
  return sources.join(" ");
}

function buildCsp(): string {
  const directives: Record<string, string> = {
    "default-src": "'self'",
    // 'unsafe-inline' es temporal hasta migrar a nonce-based (post-launch).
    "script-src": "'self' 'unsafe-inline'",
    // Tailwind v4 / next/font inyectan inline. fonts.googleapis para web fonts.
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src": "'self' https://fonts.gstatic.com data:",
    "img-src": imgSrcSources(),
    "connect-src": "'self'",
    "frame-ancestors": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "object-src": "'none'",
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  // Solo en HTTPS — fuerza upgrade de subrecursos http→https.
  if (process.env.NODE_ENV === "production") {
    parts.push("upgrade-insecure-requests");
  }
  return parts.join("; ");
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
  },
  async headers() {
    return [
      {
        // Aplica a todas las rutas. Los otros headers de seguridad
        // (HSTS, X-Frame-Options, etc.) viven en vercel.json para no
        // duplicarlos; CSP vive acá porque depende de envs en runtime.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
