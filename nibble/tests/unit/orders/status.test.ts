import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  STATUS_FLOW,
  trackingStepIndex,
  TRACKING_STEPS,
} from "@/lib/orders/status";

// La máquina de estados del pedido. Estos tests lockean la FORMA del flujo:
// si un cambio futuro rompe un invariante (ej. permite salir de DELIVERED,
// o quita la salida a CANCELLED), acá salta antes de producción.

const ALL_STATUSES = Object.values(OrderStatus);

describe("STATUS_FLOW — invariantes de la máquina de estados", () => {
  it("cubre TODOS los OrderStatus del enum (exhaustivo)", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_FLOW[s as OrderStatus]).toBeDefined();
    }
  });

  it("los estados terminales no tienen transiciones salientes", () => {
    expect(STATUS_FLOW.DELIVERED).toEqual([]);
    expect(STATUS_FLOW.CANCELLED).toEqual([]);
  });

  it("todo estado no-terminal puede ir a CANCELLED (escape hatch)", () => {
    const nonTerminal = ALL_STATUSES.filter(
      (s) => s !== "DELIVERED" && s !== "CANCELLED",
    ) as OrderStatus[];
    for (const s of nonTerminal) {
      expect(STATUS_FLOW[s]).toContain("CANCELLED");
    }
  });

  it("ninguna transición vuelve a PENDING_PAYMENT ni a NEW hacia atrás", () => {
    // Una vez que el pedido avanzó, no debe poder retroceder al inicio.
    for (const targets of Object.values(STATUS_FLOW)) {
      expect(targets).not.toContain("PENDING_PAYMENT");
    }
    // Solo PENDING_PAYMENT puede ir a NEW (verificación de pago QR).
    for (const [from, targets] of Object.entries(STATUS_FLOW)) {
      if (from !== "PENDING_PAYMENT") {
        expect(targets).not.toContain("NEW");
      }
    }
  });

  it("el happy path NEW→CONFIRMED→PREPARING→IN_DELIVERY→DELIVERED es válido", () => {
    const path: OrderStatus[] = [
      "NEW",
      "CONFIRMED",
      "PREPARING",
      "IN_DELIVERY",
      "DELIVERED",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(STATUS_FLOW[path[i]!]).toContain(path[i + 1]!);
    }
  });

  it("no hay auto-transiciones (un estado no transiciona a sí mismo)", () => {
    for (const [from, targets] of Object.entries(STATUS_FLOW)) {
      expect(targets).not.toContain(from as OrderStatus);
    }
  });
});

describe("trackingStepIndex", () => {
  it("devuelve el índice del step para estados de la timeline", () => {
    expect(trackingStepIndex("NEW")).toBe(
      TRACKING_STEPS.findIndex((s) => s.key === "NEW"),
    );
    expect(trackingStepIndex("DELIVERED")).toBe(TRACKING_STEPS.length - 1);
  });

  it("devuelve -1 para CANCELLED (fuera de la timeline lineal)", () => {
    expect(trackingStepIndex("CANCELLED")).toBe(-1);
  });
});
