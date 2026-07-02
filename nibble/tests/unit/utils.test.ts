import { describe, it, expect } from "vitest";
import {
  formatBob,
  formatBobAmount,
  buildWhatsAppUrl,
  formatWaPhone,
  nameToInitials,
} from "@/lib/utils";

// Aserciones robustas a locale: `toLocaleString("es-BO")` puede variar el
// separador según el ICU con que se compiló Node (full-icu vs small-icu).
// En vez de fijar "1.234,56", verificamos las propiedades estables: prefijo
// "Bs ", exactamente 2 decimales, y que acepte tanto `number` como el
// `Decimal` de Prisma (objeto con `toNumber()`).
const TWO_DECIMALS = /\d{2}$/;

describe("formatBob / formatBobAmount", () => {
  it("prefija 'Bs ' y deja 2 decimales", () => {
    const out = formatBob(50);
    expect(out.startsWith("Bs ")).toBe(true);
    expect(out).toMatch(TWO_DECIMALS);
  });

  it("formatBobAmount no lleva prefijo 'Bs'", () => {
    expect(formatBobAmount(50)).not.toMatch(/Bs/);
    expect(formatBobAmount(50)).toMatch(TWO_DECIMALS);
  });

  it("acepta un Decimal de Prisma (objeto con toNumber())", () => {
    const decimalLike = { toNumber: () => 1234.5 };
    const out = formatBob(decimalLike);
    expect(out.startsWith("Bs ")).toBe(true);
    // 1234.5 → dos decimales "...50"
    expect(out).toMatch(/50$/);
  });

  it("formatea cero con 2 decimales", () => {
    expect(formatBob(0)).toMatch(/0{2}$/);
  });
});

describe("buildWhatsAppUrl", () => {
  it("arma el link wa.me con teléfono limpio y mensaje encodeado", () => {
    const url = buildWhatsAppUrl("+591-70012345", "Hola mundo & cía");
    expect(url).toBe(
      "https://wa.me/59170012345?text=Hola%20mundo%20%26%20c%C3%ADa",
    );
  });

  it("devuelve string vacío si el teléfono es null/undefined", () => {
    expect(buildWhatsAppUrl(null, "x")).toBe("");
    expect(buildWhatsAppUrl(undefined, "x")).toBe("");
  });

  it("encodea caracteres reservados de URL en el mensaje", () => {
    const url = buildWhatsAppUrl("59170012345", "a?b=c#d");
    expect(url).toContain("text=a%3Fb%3Dc%23d");
  });
});

describe("formatWaPhone", () => {
  it("quita todo lo no numérico", () => {
    expect(formatWaPhone("+591-72201700")).toBe("59172201700");
    expect(formatWaPhone("+591 7001 2345")).toBe("59170012345");
  });

  it("null/undefined → string vacío", () => {
    expect(formatWaPhone(null)).toBe("");
    expect(formatWaPhone(undefined)).toBe("");
  });
});

describe("nameToInitials", () => {
  it("toma iniciales de las 2 primeras palabras en mayúscula", () => {
    expect(nameToInitials("Juan Pérez García")).toBe("JP");
    expect(nameToInitials("madriguera shop")).toBe("MS");
  });

  it("un solo nombre → una inicial", () => {
    expect(nameToInitials("Nibble")).toBe("N");
  });

  it("colapsa espacios múltiples", () => {
    expect(nameToInitials("  Ana   Sofía  ")).toBe("AS");
  });

  it("nombre vacío/null → '·'", () => {
    expect(nameToInitials("")).toBe("·");
    expect(nameToInitials(null)).toBe("·");
    expect(nameToInitials(undefined)).toBe("·");
  });
});
