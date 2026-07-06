import { describe, it, expect } from "vitest";
import {
  statusFrom,
  productLimitMessage,
  staffLimitMessage,
  type LimitStatus,
} from "@/lib/billing/plan-limits";

// La lógica de umbrales gobierna el enforcement de planes (hard: productos y
// staff) y los banners de "cerca del tope". Un error acá cobra de más o
// bloquea features que el owner sí pagó.

describe("statusFrom — límite ilimitado (null)", () => {
  it("nunca marca exceeded ni nearLimit, pct = null", () => {
    const s = statusFrom(9999, null);
    expect(s).toEqual({
      current: 9999,
      limit: null,
      pct: null,
      exceeded: false,
      nearLimit: false,
    });
  });
});

describe("statusFrom — umbrales", () => {
  it("por debajo del 80%: ni near ni exceeded", () => {
    const s = statusFrom(3, 10);
    expect(s.pct).toBe(30);
    expect(s.nearLimit).toBe(false);
    expect(s.exceeded).toBe(false);
  });

  it("exactamente 80%: nearLimit=true, exceeded=false", () => {
    const s = statusFrom(8, 10);
    expect(s.pct).toBe(80);
    expect(s.nearLimit).toBe(true);
    expect(s.exceeded).toBe(false);
  });

  it("current == limit: exceeded=true (>= no >)", () => {
    const s = statusFrom(10, 10);
    expect(s.pct).toBe(100);
    expect(s.exceeded).toBe(true);
    expect(s.nearLimit).toBe(true);
  });

  it("por encima del límite: exceeded=true, pct>100", () => {
    const s = statusFrom(12, 10);
    expect(s.pct).toBe(120);
    expect(s.exceeded).toBe(true);
  });

  it("límite 0: pct fijado a 100 (evita división por cero) y exceeded=true", () => {
    const s = statusFrom(0, 0);
    expect(s.pct).toBe(100);
    expect(s.exceeded).toBe(true);
    expect(s.nearLimit).toBe(true);
  });
});

describe("productLimitMessage", () => {
  const exceeded: LimitStatus = { current: 10, limit: 10, pct: 100, exceeded: true, nearLimit: true };

  it("mensaje con el tope cuando está excedido", () => {
    expect(productLimitMessage(exceeded)).toContain("10 productos");
  });

  it("cadena vacía cuando no está excedido", () => {
    expect(productLimitMessage(statusFrom(3, 10))).toBe("");
  });

  it("cadena vacía cuando el límite es ilimitado", () => {
    expect(productLimitMessage(statusFrom(9999, null))).toBe("");
  });
});

describe("staffLimitMessage — singular/plural", () => {
  it("usa 'cajero' en singular para límite 1", () => {
    const s: LimitStatus = { current: 1, limit: 1, pct: 100, exceeded: true, nearLimit: true };
    const msg = staffLimitMessage(s);
    expect(msg).toContain("1 cajero");
    expect(msg).not.toContain("cajeros");
  });

  it("usa 'cajeros' en plural para límite > 1", () => {
    const s: LimitStatus = { current: 3, limit: 3, pct: 100, exceeded: true, nearLimit: true };
    expect(staffLimitMessage(s)).toContain("3 cajeros");
  });

  it("cadena vacía cuando no está excedido", () => {
    expect(staffLimitMessage(statusFrom(0, 1))).toBe("");
  });
});
