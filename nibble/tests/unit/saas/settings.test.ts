import { describe, it, expect } from "vitest";
import { formatInvoiceNumber } from "@/lib/saas/settings";

/**
 * `formatInvoiceNumber` arma el número visible de factura: prefijo + secuencia
 * con padding a 6 dígitos. El correlativo es contractual (facturación SaaS),
 * así que el formato tiene que ser estable.
 */

describe("formatInvoiceNumber", () => {
  it("padea la secuencia a 6 dígitos con el prefijo", () => {
    expect(formatInvoiceNumber(42, "NIB-")).toBe("NIB-000042");
    expect(formatInvoiceNumber(1, "NIB-")).toBe("NIB-000001");
  });

  it("secuencia 0 → todos ceros", () => {
    expect(formatInvoiceNumber(0, "A")).toBe("A000000");
  });

  it("no trunca secuencias de más de 6 dígitos", () => {
    expect(formatInvoiceNumber(1234567, "X")).toBe("X1234567");
  });
});
