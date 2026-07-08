import { describe, it, expect, vi } from "vitest";
import {
  statusFrom,
  productLimitMessage,
  staffLimitMessage,
  checkProductLimit,
  checkStaffLimit,
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

// Guard de regresión del bug "no se puede crear producto".
// checkProductLimit/checkStaffLimit corren DENTRO de la transacción del CREATE
// (advisory lock). Si hacen el lookup del plan por el pool `db` en vez del `tx`
// pasado, con `connection_limit=1` la transacción se auto-bloquea (retiene la
// única conexión) y expira a los 5s. Por eso TODAS las queries del check deben
// ir por el `client` recibido.
describe("checkProductLimit — usa el client pasado para TODAS sus queries", () => {
  function makeTxClient(opts: { maxProducts: number | null; activeCount: number }) {
    return {
      store: {
        findUnique: vi.fn(async () => ({ plan: { maxProducts: opts.maxProducts } })),
      },
      product: { count: vi.fn(async () => opts.activeCount) },
      user: { count: vi.fn(async () => 0) },
    };
  }

  it("hace el lookup del plan Y el count sobre el client (no sobre el pool db)", async () => {
    const client = makeTxClient({ maxProducts: 10, activeCount: 7 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = await checkProductLimit("store-1", client as any);

    // El lookup del plan tiene que salir por el client — este es el guard del
    // deadlock. En el código buggy salía por `db` y este spy quedaba sin llamar.
    expect(client.store.findUnique).toHaveBeenCalledTimes(1);
    expect(client.product.count).toHaveBeenCalledTimes(1);
    expect(status).toMatchObject({ current: 7, limit: 10, exceeded: false });
  });

  it("respeta límite null (plan sin tope) leído por el client", async () => {
    const client = makeTxClient({ maxProducts: null, activeCount: 999 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = await checkProductLimit("store-1", client as any);
    expect(client.store.findUnique).toHaveBeenCalledTimes(1);
    expect(status.limit).toBeNull();
    expect(status.exceeded).toBe(false);
  });
});

describe("checkStaffLimit — usa el client pasado para TODAS sus queries", () => {
  it("hace el lookup del plan sobre el client (guard del mismo deadlock)", async () => {
    const client = {
      store: { findUnique: vi.fn(async () => ({ plan: { maxStaff: 1 } })) },
      user: { count: vi.fn(async () => 1) },
      product: { count: vi.fn(async () => 0) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = await checkStaffLimit("store-1", client as any);
    expect(client.store.findUnique).toHaveBeenCalledTimes(1);
    expect(client.user.count).toHaveBeenCalledTimes(1);
    expect(status).toMatchObject({ current: 1, limit: 1, exceeded: true });
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
