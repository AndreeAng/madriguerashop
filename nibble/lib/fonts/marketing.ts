import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

/**
 * Tipografía de toda la app: Bricolage Grotesque para títulos y precios,
 * Instrument Sans para el texto. El root layout pone las variables en
 * <html>; `--font-display` y `--font-sans` (globals.css) las consumen.
 *
 * Ejes: peso y ancho (los titulares condensados del marketing usan
 * `wdth`). Sin el eje de tamaño óptico, que solo afinaba detalles, el
 * archivo pesa bastante menos. No se puede separar en dos instancias:
 * next/font registra ambas con el mismo nombre de familia y el navegador
 * baja la pesada en todas las páginas.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["wdth"],
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

/** Variables de fuente para el elemento <html>. */
export const fontVariablesClass = `${display.variable} ${body.variable}`;

/**
 * Clases del sitio de marketing: `.mkt` ajusta los tokens de esas páginas
 * (fondo blanco, titulares condensados). Las fuentes ya vienen del layout.
 */
export const marketingFontClass = "mkt";
