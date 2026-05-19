import type { MetadataRoute } from "next";

function appUrl(): string {
  // `||` (no `??`) — un APP_URL="" debe caer al default. Sin esto el build
  // de Vercel rompe al construir URLs absolutas con string vacío.
  return (process.env.APP_URL || "https://madrigueras.shop").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin/",
          "/dashboard/",
          "/api/",
          "/login",
          "/recovery",
          "/uploads/",
          // El checkout tampoco debería indexarse
          "/*/checkout",
          // Páginas de tracking de pedidos son privadas
          "/*/orden/",
        ],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
