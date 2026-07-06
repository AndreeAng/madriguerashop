import { describe, it, expect } from "vitest";
import { INVALID_INPUT_ERROR } from "@/lib/validation/actionState";

describe("INVALID_INPUT_ERROR", () => {
  it("es el mensaje canónico de input inválido (mismo texto en toda la app)", () => {
    // Guard contra que alguien reintroduzca variantes ("Input inválido" etc.)
    // que desincronizarían el texto entre forms.
    expect(INVALID_INPUT_ERROR).toBe("Datos inválidos");
  });
});
