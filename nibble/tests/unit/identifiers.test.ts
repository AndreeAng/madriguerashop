import { describe, it, expect } from "vitest";
import {
  normalizeIdentifier,
  isValidIdentifier,
  normalizePhoneBO,
  PHONE_BO_RE,
} from "@/lib/auth/identifiers";

// Estos helpers gatean el login (qué cuenta se busca en DB) y la
// persistencia de teléfonos (orders, customers). Un bug de normalización
// aquí puede: (a) impedir que un usuario legítimo inicie sesión porque su
// identifier se canoniza distinto al guardado, o (b) crear duplicados de
// cuenta si el mismo teléfono se guarda en dos formatos.

describe("normalizeIdentifier — email", () => {
  it("lowercasea y trimea un email válido", () => {
    expect(normalizeIdentifier("  Owner@Nutriarte.BO  ")).toEqual({
      kind: "email",
      value: "owner@nutriarte.bo",
    });
  });

  it("reconoce emails típicos", () => {
    expect(normalizeIdentifier("test@example.com").kind).toBe("email");
  });

  it("no confunde un email con teléfono", () => {
    expect(normalizeIdentifier("a@b.co").kind).toBe("email");
  });
});

describe("normalizeIdentifier — teléfono BO", () => {
  it("8 dígitos sin prefijo → asume +591", () => {
    expect(normalizeIdentifier("70012345")).toEqual({
      kind: "phone",
      value: "+59170012345",
    });
  });

  it("591XXXXXXXX sin + → agrega +", () => {
    expect(normalizeIdentifier("59170012345")).toEqual({
      kind: "phone",
      value: "+59170012345",
    });
  });

  it("+591XXXXXXXX se mantiene canónico", () => {
    expect(normalizeIdentifier("+59170012345")).toEqual({
      kind: "phone",
      value: "+59170012345",
    });
  });

  it("limpia espacios y guiones antes de evaluar", () => {
    expect(normalizeIdentifier("+591 7001-2345")).toEqual({
      kind: "phone",
      value: "+59170012345",
    });
  });
});

describe("normalizeIdentifier — desconocido", () => {
  it("string vacío → unknown", () => {
    expect(normalizeIdentifier("   ")).toEqual({ kind: "unknown", value: "" });
  });

  it("teléfono con dígitos insuficientes → unknown", () => {
    expect(normalizeIdentifier("12345").kind).toBe("unknown");
  });

  it("basura → unknown, preservando el input trimeado", () => {
    expect(normalizeIdentifier("  no-es-nada  ")).toEqual({
      kind: "unknown",
      value: "no-es-nada",
    });
  });
});

describe("isValidIdentifier", () => {
  it("acepta email y teléfono válidos", () => {
    expect(isValidIdentifier("test@example.com")).toBe(true);
    expect(isValidIdentifier("70012345")).toBe(true);
    expect(isValidIdentifier("+59170012345")).toBe(true);
  });

  it("rechaza basura", () => {
    expect(isValidIdentifier("")).toBe(false);
    expect(isValidIdentifier("123")).toBe(false);
    expect(isValidIdentifier("no@")).toBe(false);
  });
});

describe("normalizePhoneBO", () => {
  it("canoniza todos los formatos aceptados a +591XXXXXXXX", () => {
    expect(normalizePhoneBO("70012345")).toBe("+59170012345");
    expect(normalizePhoneBO("59170012345")).toBe("+59170012345");
    expect(normalizePhoneBO("+591 7001 2345")).toBe("+59170012345");
    expect(normalizePhoneBO("+591-70012345")).toBe("+59170012345");
  });
});

describe("PHONE_BO_RE — regex compartida", () => {
  it("matchea +591XXXXXXXX y 591XXXXXXXX", () => {
    expect(PHONE_BO_RE.test("+59170012345")).toBe(true);
    expect(PHONE_BO_RE.test("59170012345")).toBe(true);
  });

  it("rechaza largos incorrectos", () => {
    expect(PHONE_BO_RE.test("+5917001234")).toBe(false); // 7 dígitos
    expect(PHONE_BO_RE.test("+591700123456")).toBe(false); // 9 dígitos
  });
});
