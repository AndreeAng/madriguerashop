import { describe, it, expect } from "vitest";
import {
  slugify,
  validateSlug,
  slugErrorMessage,
} from "@/lib/validation/slug";

describe("slugify", () => {
  it("convierte espacios y mayúsculas", () => {
    expect(slugify("Big Bite Wings")).toBe("big-bite-wings");
  });

  it("remueve acentos", () => {
    expect(slugify("Café André")).toBe("cafe-andre");
  });

  it("colapsa guiones consecutivos y trim los del borde", () => {
    expect(slugify("  --hola--mundo--  ")).toBe("hola-mundo");
  });

  it("descarta caracteres no alfanuméricos", () => {
    expect(slugify("¡Hola! ¿Cómo estás?")).toBe("hola-como-estas");
  });

  it("respeta letra ñ con normalización", () => {
    // ñ → n al hacer NFD + strip diacritics. Es un trade-off intencional.
    expect(slugify("España")).toBe("espana");
  });

  it("colapsa números a unidad", () => {
    expect(slugify("Tienda 24/7")).toBe("tienda-24-7");
  });
});

describe("validateSlug", () => {
  it("acepta slug válido típico", () => {
    expect(validateSlug("big-bite-wings")).toEqual({
      ok: true,
      value: "big-bite-wings",
    });
  });

  it("rechaza vacío", () => {
    expect(validateSlug("")).toEqual({ ok: false, reason: "empty" });
    expect(validateSlug("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rechaza muy corto (<3)", () => {
    expect(validateSlug("ab")).toEqual({ ok: false, reason: "too_short" });
  });

  it("rechaza muy largo (>32)", () => {
    const long = "a".repeat(33);
    expect(validateSlug(long)).toEqual({ ok: false, reason: "too_long" });
  });

  it("rechaza guion al borde", () => {
    expect(validateSlug("-hola")).toEqual({ ok: false, reason: "bad_format" });
    expect(validateSlug("hola-")).toEqual({ ok: false, reason: "bad_format" });
  });

  it("rechaza caracteres inválidos", () => {
    expect(validateSlug("hola_mundo")).toEqual({
      ok: false,
      reason: "bad_format",
    });
    expect(validateSlug("hola mundo")).toEqual({
      ok: false,
      reason: "bad_format",
    });
    expect(validateSlug("hola.mundo")).toEqual({
      ok: false,
      reason: "bad_format",
    });
  });

  it("rechaza slugs reservados — rutas del app", () => {
    for (const r of ["admin", "api", "dashboard", "login", "registro", "tiendas"]) {
      expect(validateSlug(r)).toEqual({ ok: false, reason: "reserved" });
    }
  });

  it("rechaza slugs reservados de marca", () => {
    for (const r of ["nibble", "madriguera", "madrigueras", "madriguerashop"]) {
      expect(validateSlug(r)).toEqual({ ok: false, reason: "reserved" });
    }
  });

  it("normaliza a lowercase antes de validar", () => {
    expect(validateSlug("BigBite")).toEqual({ ok: true, value: "bigbite" });
    expect(validateSlug("BIG-BITE-WINGS")).toEqual({
      ok: true,
      value: "big-bite-wings",
    });
  });
});

describe("slugErrorMessage", () => {
  it("traduce todas las razones a mensajes legibles en español", () => {
    expect(slugErrorMessage("empty")).toMatch(/identificador/i);
    expect(slugErrorMessage("too_short")).toMatch(/3/);
    expect(slugErrorMessage("too_long")).toMatch(/32/);
    expect(slugErrorMessage("bad_format")).toMatch(/letras|números|guiones/i);
    expect(slugErrorMessage("reserved")).toMatch(/reservado/i);
  });
});
