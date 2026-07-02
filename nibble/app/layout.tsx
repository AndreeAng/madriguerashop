import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
// CSS de Leaflet: cargado global porque los mapas pueden aparecer en
// varias rutas (checkout, detalle de pedido, analytics). El bundle es
// chico (~6KB) y se carga aunque la página no use mapa — aceptable.
import "leaflet/dist/leaflet.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Madriguera Shop — Tu tienda virtual lista en 5 minutos",
  description:
    "El SaaS de tienda virtual hecho para Bolivia. Cobra por QR, recibe pedidos por WhatsApp, opera todo desde un panel.",
  // `||` (no `??`) para que un APP_URL="" (env existe pero string vacío)
  // también caiga al default. Sin esto, `new URL("")` rompe el build de
  // Vercel al "Collecting page data" del /_not-found.
  metadataBase: new URL(process.env.APP_URL || "https://madrigueras.shop"),
  applicationName: "Madriguera Shop",
  appleWebApp: {
    capable: true,
    title: "madriguera·shop",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
  ],
};

// Script defensivo en `/public/unregister-sw.js`: desregistra cualquier
// Service Worker residual que el browser tenga del origen. Pasa cuando el
// dev tuvo OTRO proyecto en localhost que registraba SW; el SW queda
// activo cross-app porque vive por origen, no por proyecto, y empieza a
// interceptar requests devolviendo HTML cacheado de la app anterior.
// Se carga vía <Script strategy="afterInteractive"> (inyección dinámica por
// el bundle React ya autenticado) — 'strict-dynamic' propaga el trust al
// elemento creado, sin necesitar nonce propio ni causar hydration mismatch.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-BO" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        {/* WCAG 2.4.1: Skip link al inicio del body. Permite a usuarios
            de teclado y screen reader saltar la nav repetida (header
            sticky del storefront, sidebar del dashboard). Visible solo
            al recibir foco via Tab — invisible para usuarios normales. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-[color:var(--card)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-float focus:outline focus:outline-2 focus:outline-[color:var(--color-amber-500)]"
        >
          Saltar al contenido
        </a>
        {children}
        {/* Desregistra Service Workers residuales de otros proyectos en el mismo
            origen (common en dev con localhost). Cargado afterInteractive para
            que `strict-dynamic` propague el trust del bundle ya autenticado —
            no necesita nonce propio y no causa hydration mismatch. */}
        <Script src="/unregister-sw.js" strategy="afterInteractive" />
        <SpeedInsights />
      </body>
    </html>
  );
}
