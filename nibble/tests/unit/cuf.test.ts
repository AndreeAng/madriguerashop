import { describe, it, expect } from "vitest";
// Usamos `unsafeComputeCUF` — la versión con guard (`computeCUF`) exige
// SIAT_CUF_VALIDATED=true y solo aplica a runtime de producción.
import { unsafeComputeCUF as computeCUF } from "@/lib/billing/siat/cuf";

/**
 * Tests del algoritmo CUF.
 *
 * Estos tests verifican propiedades estructurales — el algoritmo exacto y los
 * dígitos verificadores deben validarse contra la herramienta oficial del SIN
 * antes de pasar a producción.
 */

const baseInput = {
  nit: "1234567890",
  fechaEmision: new Date("2026-05-06T10:30:00.000Z"),
  sucursal: 0,
  modalidad: 1 as const,
  tipoEmision: 1 as const,
  tipoFactura: 1 as const,
  tipoDocumentoSector: 1,
  numeroFactura: 1,
  puntoVenta: 0,
};

describe("computeCUF", () => {
  it("retorna un string no vacío", () => {
    const cuf = computeCUF(baseInput);
    expect(cuf).toBeTruthy();
    expect(typeof cuf).toBe("string");
    expect(cuf.length).toBeGreaterThan(0);
  });

  it("es determinista — mismo input → mismo output", () => {
    const a = computeCUF(baseInput);
    const b = computeCUF(baseInput);
    expect(a).toBe(b);
  });

  it("cambia con número de factura distinto", () => {
    const a = computeCUF({ ...baseInput, numeroFactura: 1 });
    const b = computeCUF({ ...baseInput, numeroFactura: 2 });
    expect(a).not.toBe(b);
  });

  it("cambia con fecha distinta", () => {
    const a = computeCUF(baseInput);
    const b = computeCUF({
      ...baseInput,
      fechaEmision: new Date("2026-05-07T10:30:00.000Z"),
    });
    expect(a).not.toBe(b);
  });

  it("cambia con NIT distinto", () => {
    const a = computeCUF(baseInput);
    const b = computeCUF({ ...baseInput, nit: "9876543210" });
    expect(a).not.toBe(b);
  });

  it("cambia con sucursal distinta", () => {
    const a = computeCUF(baseInput);
    const b = computeCUF({ ...baseInput, sucursal: 1 });
    expect(a).not.toBe(b);
  });

  it("retorna sólo caracteres hexadecimales válidos + dígito verificador", () => {
    const cuf = computeCUF(baseInput);
    expect(cuf).toMatch(/^[0-9A-F]+\d$/);
  });

  it("el último carácter es el dígito verificador (0-9)", () => {
    const cuf = computeCUF(baseInput);
    const verificador = cuf[cuf.length - 1];
    expect(verificador).toMatch(/^\d$/);
  });

  it("padding correcto del NIT corto", () => {
    const corto = computeCUF({ ...baseInput, nit: "123" });
    const largo = computeCUF({ ...baseInput, nit: "0000000000123" });
    // Mismo NIT lógico → mismo CUF
    expect(corto).toBe(largo);
  });

  it("modalidad electrónica genera CUF diferente al de computarizada", () => {
    const computarizada = computeCUF({ ...baseInput, modalidad: 1 });
    const electronica = computeCUF({ ...baseInput, modalidad: 2 });
    expect(computarizada).not.toBe(electronica);
  });
});
