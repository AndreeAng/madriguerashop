import { describe, it, expect } from "vitest";
import {
  ymdLocal,
  shortDate,
  shortDateWithWeekday,
  longDate,
  addDays,
  startOfWeekMonday,
  startOfDay,
  sameDay,
} from "@/lib/i18n/dates";

// tests/setup.ts fuerza TZ=UTC (como Vercel). Todas estas funciones extraen
// componentes en hora BOLIVIA (UTC-4) sin importar la TZ del proceso — el bug
// original mostraba "21 may" para un instante del 20-may 22:30 BOT. Asertamos
// instantes que cruzan la medianoche UTC para atrapar una regresión a getDate().

// 2026-05-12 es MARTES; 2026-05-11 lunes; 2026-05-10 domingo.
const MAY12_0900BOT = new Date("2026-05-12T13:00:00Z"); // 09:00 BOT del 12
const MAY11_2200BOT = new Date("2026-05-12T02:00:00Z"); // 22:00 BOT del 11 (cruza medianoche UTC)

describe("ymdLocal", () => {
  it("formatea YYYY-MM-DD en hora Bolivia", () => {
    expect(ymdLocal(MAY12_0900BOT)).toBe("2026-05-12");
  });
  it("resta el día cuando el instante UTC es de madrugada", () => {
    expect(ymdLocal(MAY11_2200BOT)).toBe("2026-05-11");
  });
});

describe("shortDate / shortDateWithWeekday / longDate", () => {
  it("shortDate: 'DD mmm' en Bolivia", () => {
    expect(shortDate(MAY12_0900BOT)).toBe("12 may");
  });
  it("shortDate acepta un ISO string", () => {
    expect(shortDate("2026-04-10T13:00:00Z")).toBe("10 abr");
  });
  it("shortDateWithWeekday: 'ddd, DD mmm'", () => {
    expect(shortDateWithWeekday(MAY12_0900BOT)).toBe("mar, 12 may");
  });
  it("longDate: 'weekday DD de mes'", () => {
    expect(longDate(MAY12_0900BOT)).toBe("martes 12 de mayo");
  });
  it("las funciones usan el día calendario BOLIVIA, no UTC", () => {
    // Instante que en UTC es 12-may pero en Bolivia es 11-may.
    expect(shortDate(MAY11_2200BOT)).toBe("11 may");
  });
});

describe("addDays", () => {
  it("suma días sin mutar el original", () => {
    const base = new Date("2026-05-12T13:00:00Z");
    const plus3 = addDays(base, 3);
    expect(plus3.toISOString()).toBe("2026-05-15T13:00:00.000Z");
    expect(base.toISOString()).toBe("2026-05-12T13:00:00.000Z"); // intacto
  });
  it("acepta deltas negativos", () => {
    expect(addDays(new Date("2026-05-12T13:00:00Z"), -2).toISOString()).toBe(
      "2026-05-10T13:00:00.000Z",
    );
  });
});

describe("startOfDay", () => {
  it("devuelve 00:00 hora Bolivia (04:00 UTC)", () => {
    expect(startOfDay(MAY12_0900BOT).toISOString()).toBe("2026-05-12T04:00:00.000Z");
  });
  it("un instante de madrugada UTC ancla al día Bolivia anterior", () => {
    expect(startOfDay(MAY11_2200BOT).toISOString()).toBe("2026-05-11T04:00:00.000Z");
  });
});

describe("startOfWeekMonday", () => {
  it("un martes ancla al lunes de esa semana (00:00 BOT)", () => {
    expect(startOfWeekMonday(MAY12_0900BOT).toISOString()).toBe(
      "2026-05-11T04:00:00.000Z",
    );
  });
  it("un domingo ancla al lunes ANTERIOR (caso especial day===0)", () => {
    // 2026-05-10 es domingo → su lunes es el 4-may, no el 11.
    const sunday = new Date("2026-05-10T13:00:00Z");
    expect(startOfWeekMonday(sunday).toISOString()).toBe("2026-05-04T04:00:00.000Z");
  });
});

describe("sameDay", () => {
  it("true para dos horas del mismo día Bolivia", () => {
    expect(
      sameDay(new Date("2026-05-12T13:00:00Z"), new Date("2026-05-12T20:00:00Z")),
    ).toBe(true);
  });
  it("true cruzando medianoche UTC pero mismo día Bolivia", () => {
    // 02:00Z (11-may 22:00 BOT) y 13:00Z del 11 (09:00 BOT) = ambos 11-may BOT.
    expect(sameDay(MAY11_2200BOT, new Date("2026-05-11T13:00:00Z"))).toBe(true);
  });
  it("false para días Bolivia distintos", () => {
    expect(
      sameDay(new Date("2026-05-12T13:00:00Z"), new Date("2026-05-11T13:00:00Z")),
    ).toBe(false);
  });
});
