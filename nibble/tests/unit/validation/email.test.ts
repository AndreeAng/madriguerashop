import { describe, it, expect } from "vitest";
import { EMAIL_RE } from "@/lib/validation/email";

// `EMAIL_RE` es la fuente única de verdad para validar email en toda la app
// (los schemas Zod la consumen en su refine). Fija su comportamiento REAL,
// no la intención del comentario — ver el caso de dígitos en el TLD abajo.

const ok = (s: string) => expect(EMAIL_RE.test(s)).toBe(true);
const no = (s: string) => expect(EMAIL_RE.test(s)).toBe(false);

describe("EMAIL_RE — acepta emails válidos", () => {
  it("forma canónica", () => {
    ok("owner@bigbitewings.bo");
    ok("a@b.co");
    ok("user.name+tag@example.com");
  });

  it("subdominios (puntos en la parte de dominio)", () => {
    ok("user@sub.example.com");
  });
});

describe("EMAIL_RE — rechaza inválidos", () => {
  it("sin arroba", () => no("userexample.com"));
  it("sin dominio", () => no("user@"));
  it("sin TLD (falta punto)", () => no("user@example"));
  it("TLD de un solo carácter", () => no("user@example.c"));
  it("doble arroba", () => no("user@@example.com"));
  it("espacios", () => {
    no("user @example.com");
    no("user@ example.com");
    no(" user@example.com");
  });
  it("punto final sobrante tras el TLD", () => no("user@example.com."));
  it("string vacío", () => no(""));

  it("local part de más de 64 chars", () => {
    no(`${"a".repeat(65)}@example.com`);
    ok(`${"a".repeat(64)}@example.com`);
  });
});

describe("EMAIL_RE — comportamiento documentado vs real", () => {
  it("ACEPTA dígitos en el TLD pese a que el comentario dice 'no numbers'", () => {
    // La regex usa [^\s@.]{2,63} para el TLD, que SÍ permite dígitos. El
    // docstring de email.ts afirma lo contrario. No es un bug de seguridad
    // (aceptar 'foo.co2' es inocuo), pero este test deja registrado que el
    // comportamiento efectivo permite dígitos — si alguien "arregla" el
    // comentario endureciendo la regex, este test se lo avisa.
    ok("user@example.co2");
  });
});
