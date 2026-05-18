import { describe, it, expect } from "vitest";
import { buildFacturaXml } from "@/lib/billing/siat/builder";
import type { FacturaInput } from "@/lib/billing/siat/types";

/**
 * Tests del XML builder de Factura Computarizada SIAT.
 *
 * Lo crítico que validan estos tests:
 *   1. `montoTotalMoneda` se divide por `tipoCambio` cuando NO es BOB.
 *      Si esto se rompe, se reportan facturas en USD con montos en BOB al
 *      fisco boliviano — rechazo 980 o (peor) factura válida con monto
 *      erróneo reportado al SIN.
 *   2. El escape XML cubre los 5 caracteres especiales sin escapar otros.
 *   3. Campos numéricos están formateados con 2 decimales fijos.
 */

function baseInput(overrides: Partial<FacturaInput> = {}): FacturaInput {
  return {
    cuf: "ABC123",
    cufd: "DEF456",
    numeroFactura: 1,
    fechaEmision: new Date("2026-05-13T14:30:00.000Z"),
    emisor: {
      nit: "1234567890",
      razonSocial: "Tienda Demo SRL",
      municipio: "La Paz",
      sucursal: 0,
      puntoVenta: 0,
      actividadEconomica: "476200",
    },
    cliente: {
      documento: "1234567",
      tipoDocumento: 1,
      nombre: "Juan Pérez",
    },
    items: [
      {
        codigoProductoSin: "12345",
        codigoProducto: "SKU-001",
        descripcion: "Producto demo",
        cantidad: 1,
        unidadMedida: 58,
        precioUnitario: 100,
        montoDescuento: 0,
        subTotal: 100,
      },
    ],
    montoSubtotal: 100,
    montoDescuento: 0,
    montoGiftCard: 0,
    montoTotal: 100,
    montoTotalSujetoIva: 100,
    codigoMoneda: 1,
    tipoCambio: 1,
    metodoPago: 1,
    leyenda: "Ley N° 453 - Defensa al Consumidor",
    usuario: "admin",
    ...overrides,
  };
}

describe("buildFacturaXml", () => {
  describe("estructura básica", () => {
    it("incluye los campos canónicos del XSD SIAT", () => {
      const xml = buildFacturaXml(baseInput());
      expect(xml).toContain("<facturaComputarizadaCompraVenta");
      expect(xml).toContain("<nitEmisor>1234567890</nitEmisor>");
      expect(xml).toContain("<numeroFactura>1</numeroFactura>");
      expect(xml).toContain("<cuf>ABC123</cuf>");
      expect(xml).toContain("<cufd>DEF456</cufd>");
      expect(xml).toContain("<montoTotal>100.00</montoTotal>");
    });

    it("renderiza los items detalle", () => {
      const xml = buildFacturaXml(baseInput());
      expect(xml).toContain("<detalle>");
      expect(xml).toContain("<descripcion>Producto demo</descripcion>");
      expect(xml).toContain("<precioUnitario>100.00</precioUnitario>");
    });
  });

  describe("regression — tipoCambio aplicado a montoTotalMoneda", () => {
    // Bug original: `montoTotalMoneda` siempre se emitía igual a `montoTotal`,
    // ignorando `tipoCambio`. Reproducimos los dos escenarios.

    it("BOB (tipoCambio=1): montoTotalMoneda igual a montoTotal", () => {
      const xml = buildFacturaXml(
        baseInput({ codigoMoneda: 1, tipoCambio: 1, montoTotal: 100 }),
      );
      expect(xml).toContain("<montoTotalMoneda>100.00</montoTotalMoneda>");
    });

    it("USD (tipoCambio≠1): montoTotalMoneda = montoTotal / tipoCambio", () => {
      // Factura por 696 BOB con tipoCambio USD-BOB de 6.96 → 100.00 USD
      const xml = buildFacturaXml(
        baseInput({
          codigoMoneda: 2,
          tipoCambio: 6.96,
          montoTotal: 696,
        }),
      );
      // Antes del fix esto era "<montoTotalMoneda>696.00</montoTotalMoneda>"
      // (incorrectamente reportaba 696 USD al SIN). Con el fix: 100.00 USD.
      expect(xml).toContain("<montoTotalMoneda>100.00</montoTotalMoneda>");
    });

    it("tipoCambio decimal redondea a 2 decimales", () => {
      // 100 / 7.13 = 14.02524... → toFixed(2) → "14.03" (round-half-up)
      const xml = buildFacturaXml(
        baseInput({
          codigoMoneda: 2,
          tipoCambio: 7.13,
          montoTotal: 100,
        }),
      );
      expect(xml).toContain("<montoTotalMoneda>14.03</montoTotalMoneda>");
    });
  });

  describe("escape XML", () => {
    it("escapa & en razón social", () => {
      const xml = buildFacturaXml(
        baseInput({
          emisor: {
            nit: "1234567890",
            razonSocial: "Pérez & Cía S.A.",
            municipio: "La Paz",
            sucursal: 0,
            puntoVenta: 0,
            actividadEconomica: "476200",
          },
        }),
      );
      expect(xml).toContain("Pérez &amp; Cía S.A.");
      expect(xml).not.toMatch(/razonSocialEmisor>Pérez & Cía/);
    });

    it("escapa <, >, comillas y apóstrofes", () => {
      const xml = buildFacturaXml(
        baseInput({
          cliente: {
            documento: "1234567",
            tipoDocumento: 1,
            nombre: `O'Brien "El <Jefe>"`,
          },
        }),
      );
      expect(xml).toContain("O&apos;Brien &quot;El &lt;Jefe&gt;&quot;");
    });

    it("no escapa caracteres seguros (acentos)", () => {
      const xml = buildFacturaXml(
        baseInput({
          cliente: {
            documento: "1234567",
            tipoDocumento: 1,
            nombre: "María José Núñez",
          },
        }),
      );
      // Los acentos NO se escapan — UTF-8 los maneja directamente.
      expect(xml).toContain("María José Núñez");
    });
  });

  describe("formato de montos", () => {
    it("siempre dos decimales fijos (no más, no menos)", () => {
      const xml = buildFacturaXml(
        baseInput({ montoTotal: 99.5, montoSubtotal: 99.5 }),
      );
      expect(xml).toContain("<montoTotal>99.50</montoTotal>");
    });

    it("redondea pero no formatea en notación científica", () => {
      const xml = buildFacturaXml(baseInput({ montoTotal: 1_000_000 }));
      expect(xml).toContain("<montoTotal>1000000.00</montoTotal>");
      expect(xml).not.toMatch(/1e\+|1E\+/);
    });
  });
});
