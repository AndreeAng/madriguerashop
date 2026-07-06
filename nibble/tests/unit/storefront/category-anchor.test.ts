import { describe, it, expect } from "vitest";
import { categoryAnchorId } from "@/lib/storefront/category-anchor";

/**
 * `categoryAnchorId` genera el id de ancla DOM de una categoría. Client y
 * server DEBEN generar el mismo valor a partir del nombre (los chips del menú
 * apuntan a `#cat-<anchor>`), y "Café"/"Cafe" deben colisionar en el mismo id.
 */

describe("categoryAnchorId", () => {
  it("pasa a minúsculas y reemplaza espacios por guiones", () => {
    expect(categoryAnchorId("Bebidas Calientes")).toBe("bebidas-calientes");
  });

  it("quita acentos: 'Café' y 'Cafe' colisionan", () => {
    expect(categoryAnchorId("Café")).toBe("cafe");
    expect(categoryAnchorId("Cafe")).toBe("cafe");
  });

  it("normaliza ñ y otras marcas combinantes", () => {
    expect(categoryAnchorId("Ñoño")).toBe("nono");
    expect(categoryAnchorId("Piñata")).toBe("pinata");
  });

  it("colapsa múltiples espacios en un solo guión", () => {
    expect(categoryAnchorId("Postres   y   Dulces")).toBe("postres-y-dulces");
  });
});
