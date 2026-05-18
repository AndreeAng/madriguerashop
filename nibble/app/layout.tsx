import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
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
  metadataBase: new URL(process.env.APP_URL ?? "https://madrigueras.shop"),
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
// Síntoma típico: "subí código nuevo pero el browser muestra la versión
// vieja". El script vive como archivo estático (no inline) para que la
// CSP pueda prohibir scripts inline sin excepción — un XSS futuro no
// puede inyectar `<script>` y ejecutarse.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-BO" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <script src="/unregister-sw.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
