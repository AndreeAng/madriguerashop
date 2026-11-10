import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

/**
 * Tipografía de toda la app: Bricolage Grotesque para títulos y precios,
 * Instrument Sans para el texto. El root layout pone las variables en
 * <html>; `--font-display` y `--font-sans` (globals.css) las consumen.
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

/** Variables de fuente para el elemento <html>. */
export const fontVariablesClass = `${display.variable} ${body.variable}`;

/**
 * Clases del sitio de marketing: las mismas fuentes más `.mkt`, que ajusta
 * los tokens de las páginas de marketing (fondo blanco, titulares
 * condensados). Las variables se repiten por si una página se renderiza
 * fuera del layout raíz.
 */
export const marketingFontClass = `${fontVariablesClass} mkt`;
