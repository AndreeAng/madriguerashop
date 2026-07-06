import { describe, it, expect, afterEach } from "vitest";
import {
  isLegalEntityComplete,
  legalEntityName,
  legalEntityAddress,
} from "@/lib/legal/entity";

/**
 * La entidad legal se lee de `process.env` en CADA llamada (no cacheada en
 * import) para que un cambio de env var en runtime se refleje. Los textos de
 * /terminos y /privacidad usan estos helpers; si faltan datos, muestran un
 * banner de "borrador" y caen a valores genéricos seguros.
 */

const KEYS = [
  "LEGAL_ENTITY_NAME",
  "LEGAL_ENTITY_ADDRESS",
  "LEGAL_ENTITY_CONTACT_EMAIL",
  "LEGAL_ENTITY_TAX_ID",
] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("cuando la entidad legal está completa", () => {
  it("isLegalEntityComplete=true y los helpers devuelven los valores reales", () => {
    process.env.LEGAL_ENTITY_NAME = "Nibble S.R.L.";
    process.env.LEGAL_ENTITY_ADDRESS = "Av. Siempre Viva 123, Cochabamba";
    expect(isLegalEntityComplete()).toBe(true);
    expect(legalEntityName()).toBe("Nibble S.R.L.");
    expect(legalEntityAddress()).toBe("Av. Siempre Viva 123, Cochabamba");
  });
});

describe("cuando faltan datos (modo borrador)", () => {
  it("isLegalEntityComplete=false si falta el nombre o la dirección", () => {
    process.env.LEGAL_ENTITY_NAME = "Nibble S.R.L.";
    // sin address
    expect(isLegalEntityComplete()).toBe(false);
  });

  it("los helpers caen a valores genéricos seguros", () => {
    // sin ninguna env var seteada
    expect(isLegalEntityComplete()).toBe(false);
    expect(legalEntityName()).toBe("Madriguera Shop");
    expect(legalEntityAddress()).toBe("Cochabamba, Bolivia");
  });
});
