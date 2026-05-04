import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

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
  title: "Nibble — Tu tienda virtual lista en 5 minutos",
  description:
    "El SaaS de tienda virtual hecho para Bolivia. Cobra por QR, recibe pedidos por WhatsApp, opera todo desde un panel.",
  metadataBase: new URL("https://nibble.bo"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-BO" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
