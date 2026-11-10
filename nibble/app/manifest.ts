import type { MetadataRoute } from "next";

/**
 * PWA manifest. Permite instalación en home de mobile e iconos en task switcher.
 *
 * Para PWA "completa" hace falta también un service worker (Phase 2 del roadmap).
 * Por ahora con manifest sólo se logra el "Add to Home Screen" en mobile.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Madriguera Shop",
    short_name: "madriguera·shop",
    description:
      "Plataforma SaaS de tiendas virtuales en Bolivia. Cobra por QR, atiende por WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f9",
    theme_color: "#121016",
    lang: "es-BO",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    categories: ["business", "shopping", "productivity"],
  };
}
