/**
 * Parser CSV server-side. Soporta:
 *   - Headers en la primera fila
 *   - Comillas dobles con escape `""`
 *   - Saltos de línea dentro de celdas entre comillas
 *   - Coma y CRLF/LF como separadores
 *
 * NO soporta:
 *   - Delimitadores no-coma (tab, ;) — para BO el estándar es coma
 *   - Comentarios (`#`)
 *   - Encoding non-UTF8 (Excel guarda en UTF-8 BOM por default)
 *
 * Si la complejidad crece (delimitadores configurables, BOM handling
 * fino, dialect detection), migrar a `papaparse`. Hasta ahí, esta
 * implementación de 60 líneas evita la dep.
 */

const BOM_RE = /^﻿/;

type CsvRow = Record<string, string>;
export type ParseResult = {
  rows: CsvRow[];
  headers: string[];
  /** Errores de parse a nivel línea — celdas malformadas, etc. NO son
   *  errores de validación de negocio. */
  parseErrors: { line: number; reason: string }[];
};

export function parseCsv(input: string): ParseResult {
  const text = input.replace(BOM_RE, "");
  const cells: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let lineNum = 1;
  const errors: ParseResult["parseErrors"] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") lineNum++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (cell !== "") {
        errors.push({ line: lineNum, reason: 'comilla en medio de celda no escapada' });
      }
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      cells.push(row);
      row = [];
      cell = "";
      lineNum++;
      continue;
    }
    cell += ch;
  }
  // Última celda/fila sin newline final
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    cells.push(row);
  }

  if (cells.length === 0) {
    return { rows: [], headers: [], parseErrors: errors };
  }

  const headers = (cells[0] ?? []).map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];
  for (let r = 1; r < cells.length; r++) {
    const raw = cells[r]!;
    // Saltar filas completamente vacías
    if (raw.every((c) => c.trim() === "")) continue;
    const obj: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      obj[header] = (raw[c] ?? "").trim();
    }
    rows.push(obj);
  }

  return { rows, headers, parseErrors: errors };
}
