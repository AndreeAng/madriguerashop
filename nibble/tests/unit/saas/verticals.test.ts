import { describe, it, expect } from "vitest";
import { VERTICAL_LABELS, verticalLabel } from "@/lib/saas/verticals";

describe("VERTICAL_LABELS", () => {
  it("tiene un label para cada una de las 10 verticales", () => {
    expect(Object.keys(VERTICAL_LABELS).sort()).toEqual(
      [
        "BAKERY",
        "BEAUTY",
        "FOOD_TRUCK",
        "GROCERY",
        "HARDWARE",
        "HEALTH",
        "OTHER",
        "RESTAURANT",
        "RETAIL",
        "SERVICES",
      ].sort(),
    );
  });

  it("los labels no están vacíos", () => {
    for (const label of Object.values(VERTICAL_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("verticalLabel", () => {
  it("devuelve el label legible de una vertical conocida", () => {
    expect(verticalLabel("RESTAURANT")).toBe("Restaurante");
    expect(verticalLabel("SERVICES")).toBe("Servicios");
  });

  it("cae al valor crudo si la vertical no existe en el mapa", () => {
    expect(verticalLabel("UNKNOWN_VERTICAL")).toBe("UNKNOWN_VERTICAL");
    expect(verticalLabel("")).toBe("");
  });
});
