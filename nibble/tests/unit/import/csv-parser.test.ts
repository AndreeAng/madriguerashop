import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/import/csv-parser";

// El CSV lo sube el owner (import de productos): input NO confiable. Estos
// tests fijan el contrato del parser artesanal antes de que crezca y se
// tenga que migrar a papaparse.

describe("parseCsv — básico", () => {
  it("parsea headers + filas simples", () => {
    const r = parseCsv("name,price\nPizza,50\nSoda,10");
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.rows).toEqual([
      { name: "Pizza", price: "50" },
      { name: "Soda", price: "10" },
    ]);
    expect(r.parseErrors).toHaveLength(0);
  });

  it("normaliza headers a minúsculas y trim", () => {
    const r = parseCsv("  Name , PRICE \nx,1");
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.rows[0]).toEqual({ name: "x", price: "1" });
  });

  it("hace trim de los valores de celda", () => {
    const r = parseCsv("name,price\n  Pizza  ,  50  ");
    expect(r.rows[0]).toEqual({ name: "Pizza", price: "50" });
  });

  it("strippea el BOM UTF-8 del inicio", () => {
    const r = parseCsv("﻿name,price\nx,1");
    expect(r.headers).toEqual(["name", "price"]);
  });
});

describe("parseCsv — comillas", () => {
  it("respeta comas dentro de campos entre comillas", () => {
    const r = parseCsv('name,note\n"Pizza, grande",hola');
    expect(r.rows[0]).toEqual({ name: "Pizza, grande", note: "hola" });
  });

  it("desescapa comillas dobles internas (\"\" → \")", () => {
    const r = parseCsv('name\n"a""b"');
    expect(r.rows[0]).toEqual({ name: 'a"b' });
  });

  it("permite saltos de línea dentro de un campo entre comillas", () => {
    const r = parseCsv('name\n"line1\nline2"');
    expect(r.rows[0]).toEqual({ name: "line1\nline2" });
  });

  it("reporta parseError si una comilla abre en medio de una celda no vacía", () => {
    const r = parseCsv('name\nab"c');
    expect(r.parseErrors).toHaveLength(1);
    expect(r.parseErrors[0]?.reason).toMatch(/comilla/i);
  });
});

describe("parseCsv — saltos de línea y filas", () => {
  it("soporta CRLF además de LF", () => {
    const r = parseCsv("name,price\r\nx,1\r\n");
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.rows).toEqual([{ name: "x", price: "1" }]);
  });

  it("salta filas completamente vacías", () => {
    const r = parseCsv("name\nx\n\n\ny");
    expect(r.rows).toEqual([{ name: "x" }, { name: "y" }]);
  });

  it("captura la última fila aunque no termine en newline", () => {
    const r = parseCsv("name\nx");
    expect(r.rows).toEqual([{ name: "x" }]);
  });
});

describe("parseCsv — desajuste de columnas", () => {
  it("rellena con '' cuando la fila tiene menos celdas que headers", () => {
    const r = parseCsv("a,b,c\n1,2");
    expect(r.rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("descarta celdas extra cuando la fila tiene más que headers", () => {
    const r = parseCsv("a\n1,2,3");
    expect(r.rows[0]).toEqual({ a: "1" });
  });
});

describe("parseCsv — casos límite", () => {
  it("input vacío → todo vacío", () => {
    expect(parseCsv("")).toEqual({ rows: [], headers: [], parseErrors: [] });
  });

  it("solo header, sin filas de datos", () => {
    const r = parseCsv("name,price");
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.rows).toEqual([]);
  });
});
