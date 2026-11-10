import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

/**
 * Tipografía del sitio de marketing (landing, header y footer de marketing).
 * Vive aparte de Inter/Fraunces del root layout: la tienda y el panel no
 * cargan estas fuentes, solo las páginas que usan la clase `.mkt`.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz", "wdth"],
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  axes: ["wdth"],
});

/** Clases que activan las fuentes y los tokens del mundo de marketing. */
export const marketingFontClass = `${display.variable} ${body.variable} mkt`;
