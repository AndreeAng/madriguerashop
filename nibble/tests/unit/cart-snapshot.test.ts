import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  computeCartLines,
  type CartProductInfo,
  type CartWithItems,
} from "@/lib/cart/snapshot";

/**
 * Tests de detección de huérfanos en el snapshot del carrito.
 *
 * Bug original (Sprint 2): si el owner desactivaba un producto o eliminaba
 * una variante referenciada por carts vivos, el cart del cliente:
 *   - mostraba la línea con datos rotos (variant null, precio del producto
 *     base en vez de la variante), o
 *   - silenciosamente perdía la elección sin avisar al cliente, que
 *     pagaba algo distinto a lo que vio al armar el carrito.
 *
 * El fix: `computeCartLines` descarta cualquier línea inconsistente y
 * devuelve los IDs huérfanos para que el caller los borre de DB y muestre
 * el banner "el producto cambió, revisa tu carrito".
 */

// Helpers para armar fixtures legibles
const NOW = new Date("2026-05-13T10:00:00Z");

function product(
  id: string,
  overrides: Partial<CartProductInfo> = {},
): CartProductInfo {
  return {
    id,
    name: `Producto ${id}`,
    slug: `producto-${id}`,
    basePrice: 50,
    isActive: true,
    ...overrides,
  };
}

function item(
  id: string,
  productId: string,
  overrides: Partial<CartWithItems["items"][number]> = {},
): CartWithItems["items"][number] {
  return {
    id,
    cartId: "cart-1",
    productId,
    variantId: null,
    quantity: 1,
    notes: null,
    unitPrice: new Prisma.Decimal(50),
    createdAt: NOW,
    variant: null,
    ...overrides,
  };
}

function activeVariant(id: string, price = 75) {
  return {
    id,
    name: `Variante ${id}`,
    price: new Prisma.Decimal(price),
    isActive: true,
  };
}

function map(...products: CartProductInfo[]): Map<string, CartProductInfo> {
  return new Map(products.map((p) => [p.id, p]));
}

describe("computeCartLines — caminos felices", () => {
  it("retorna lines vacías y subtotal=0 para cart sin items", () => {
    const r = computeCartLines([], map());
    expect(r.lines).toEqual([]);
    expect(r.subtotal).toBe(0);
    expect(r.orphanIds).toEqual([]);
  });

  it("materializa item simple (sin variante)", () => {
    const r = computeCartLines(
      [item("i1", "p1", { quantity: 2, unitPrice: new Prisma.Decimal(50) })],
      map(product("p1")),
    );
    expect(r.orphanIds).toEqual([]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]?.lineTotal).toBe(100);
    expect(r.subtotal).toBe(100);
  });

  it("usa el unitPrice del CartItem (no del producto)", () => {
    // Si el owner subió el precio después de que el cliente agregó al
    // carrito, el snapshot DEBE mostrar el unitPrice almacenado al
    // momento de agregar — no el precio actual del producto. Sin esto,
    // el cliente ve un precio en la UI y paga otro al checkout.
    const r = computeCartLines(
      [item("i1", "p1", { unitPrice: new Prisma.Decimal(40) })],
      map(product("p1", { basePrice: 999 })),
    );
    expect(r.lines[0]?.unitPrice).toBe(40);
    expect(r.lines[0]?.lineTotal).toBe(40);
  });

  it("materializa item con variante activa", () => {
    const r = computeCartLines(
      [
        item("i1", "p1", {
          variantId: "v1",
          variant: activeVariant("v1", 75),
          unitPrice: new Prisma.Decimal(75),
        }),
      ],
      map(product("p1")),
    );
    expect(r.orphanIds).toEqual([]);
    expect(r.lines[0]?.variant?.name).toBe("Variante v1");
    expect(r.lines[0]?.variant?.price).toBe(75);
  });
});

describe("computeCartLines — descartes (los 4 caminos del Sprint 2)", () => {
  it("(1) producto no existe en el map → orphan", () => {
    const r = computeCartLines([item("i1", "missing")], map());
    expect(r.lines).toEqual([]);
    expect(r.orphanIds).toEqual(["i1"]);
    expect(r.subtotal).toBe(0);
  });

  it("(2) producto existe pero isActive=false → orphan", () => {
    const r = computeCartLines(
      [item("i1", "p1")],
      map(product("p1", { isActive: false })),
    );
    expect(r.lines).toEqual([]);
    expect(r.orphanIds).toEqual(["i1"]);
  });

  it("(3) item con variantId pero variant=null (variante eliminada) → orphan", () => {
    const r = computeCartLines(
      [item("i1", "p1", { variantId: "v-eliminada", variant: null })],
      map(product("p1")),
    );
    expect(r.lines).toEqual([]);
    expect(r.orphanIds).toEqual(["i1"]);
  });

  it("(4) variante existe pero isActive=false → orphan", () => {
    const r = computeCartLines(
      [
        item("i1", "p1", {
          variantId: "v1",
          variant: { ...activeVariant("v1"), isActive: false },
        }),
      ],
      map(product("p1")),
    );
    expect(r.lines).toEqual([]);
    expect(r.orphanIds).toEqual(["i1"]);
  });
});

describe("computeCartLines — escenarios mixtos", () => {
  it("descarta el item dañado pero conserva los sanos", () => {
    const items = [
      item("ok1", "p1"),
      item("orphan", "p-deleted"),
      item("ok2", "p2"),
    ];
    const r = computeCartLines(items, map(product("p1"), product("p2")));
    expect(r.lines.map((l) => l.id).sort()).toEqual(["ok1", "ok2"]);
    expect(r.orphanIds).toEqual(["orphan"]);
    expect(r.subtotal).toBe(100); // 50 + 50
  });

  it("orden de evaluación: producto inactivo manda sobre variante (no doble-cuenta)", () => {
    // Si tanto el producto como su variante están inactivos, debe
    // contarse UNA vez como huérfano (no dos veces, no skipear).
    const r = computeCartLines(
      [
        item("i1", "p1", {
          variantId: "v1",
          variant: { ...activeVariant("v1"), isActive: false },
        }),
      ],
      map(product("p1", { isActive: false })),
    );
    expect(r.orphanIds).toEqual(["i1"]);
    expect(r.lines).toEqual([]);
  });

  it("acepta basePrice como Prisma.Decimal", () => {
    // Reflejo de cómo viene del findMany real — `basePrice` es Decimal.
    // El extractor convierte a número con .toNumber().
    const r = computeCartLines(
      [item("i1", "p1")],
      map(product("p1", { basePrice: new Prisma.Decimal("99.99") })),
    );
    expect(r.lines[0]?.product.basePrice).toBe(99.99);
  });
});
