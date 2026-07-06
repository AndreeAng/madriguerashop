import { describe, it, expect } from "vitest";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { REAL_SALE_WHERE } from "@/lib/orders/revenue";

// Test-guard del filtro canónico de "venta real". El bug que motivó extraer
// este objeto fue que cada pantalla filtraba distinto y los números de
// revenue no cuadraban entre owner/admin/analytics. Si alguien afloja el
// filtro (deja de excluir REFUNDED, por ejemplo), este test lo frena.

describe("REAL_SALE_WHERE", () => {
  it("excluye CANCELLED y PENDING_PAYMENT por status", () => {
    expect(REAL_SALE_WHERE.status).toEqual({
      notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT],
    });
  });

  it("excluye pagos REFUNDED", () => {
    expect(REAL_SALE_WHERE.paymentStatus).toEqual({
      not: PaymentStatus.REFUNDED,
    });
  });

  it("no filtra por ningún otro campo (evita esconder ventas reales)", () => {
    expect(Object.keys(REAL_SALE_WHERE).sort()).toEqual([
      "paymentStatus",
      "status",
    ]);
  });
});
