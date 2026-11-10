import { describe, it, expect } from "vitest";
import { storeActionColors } from "@/lib/storefront/theme";

describe("storeActionColors", () => {
  it("usa tinta oscura sobre colores claros", () => {
    expect(storeActionColors("#fde047").onAction).toBe("#100c08");
  });

  it("usa blanco sobre colores oscuros", () => {
    expect(storeActionColors("#1e3a8a").onAction).toBe("#ffffff");
  });

  it("cae al ámbar de la plataforma con el default del schema", () => {
    expect(storeActionColors("#3B82F6").action).toBe("#db7706");
  });

  it("cae al ámbar con un valor que no es hex de 6 dígitos", () => {
    expect(storeActionColors("rojo").action).toBe("#db7706");
  });
});
