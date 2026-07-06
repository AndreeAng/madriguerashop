import { describe, it, expect } from "vitest";
import {
  dateInBolivia,
  parseBoliviaDate,
  parseBoliviaDateTime,
  toBoliviaDatetimeLocal,
  inBolivia,
} from "@/lib/booking/timezone";

// tests/setup.ts fuerza TZ=UTC (como Vercel). Estos helpers DEBEN producir
// el mismo instante sin importar la TZ del proceso — ese fue el bug original
// que corría los slots 4 h. Los tests asertan instantes UTC absolutos para
// que un regreso a `new Date(y,m,d,...)` (dependiente de TZ) los rompa.

describe("dateInBolivia", () => {
  it("09:00 BOT → 13:00 UTC (offset +4)", () => {
    expect(dateInBolivia(2026, 4, 12, 9, 0).toISOString()).toBe(
      "2026-05-12T13:00:00.000Z",
    );
  });

  it("00:00 BOT → 04:00 UTC del mismo día", () => {
    expect(dateInBolivia(2026, 4, 12).toISOString()).toBe(
      "2026-05-12T04:00:00.000Z",
    );
  });

  it("medianoche BOT cae en el día calendario UTC correcto", () => {
    // 00:00 BOT del 1-ene = 04:00 UTC del 1-ene, NO 31-dic.
    expect(dateInBolivia(2026, 0, 1).toISOString()).toBe(
      "2026-01-01T04:00:00.000Z",
    );
  });
});

describe("parseBoliviaDate", () => {
  it("interpreta YYYY-MM-DD como 00:00 hora Bolivia", () => {
    expect(parseBoliviaDate("2026-05-12")?.toISOString()).toBe(
      "2026-05-12T04:00:00.000Z",
    );
  });

  it("rechaza formato que no matchea (null)", () => {
    expect(parseBoliviaDate("2026-5-12")).toBeNull(); // mes de 1 dígito
    expect(parseBoliviaDate("12/05/2026")).toBeNull();
    expect(parseBoliviaDate("hoy")).toBeNull();
    expect(parseBoliviaDate("")).toBeNull();
  });

  it("rechaza overflow silencioso de mes/día (null en vez de fecha absurda)", () => {
    // Sin la validación anti-overflow, Date.UTC 'rolea' estos valores a
    // fechas válidas y quedarían guardados como basura.
    expect(parseBoliviaDate("2026-13-01")).toBeNull(); // mes 13
    expect(parseBoliviaDate("2026-00-10")).toBeNull(); // mes 0
    expect(parseBoliviaDate("2026-02-31")).toBeNull(); // 31 de febrero
    expect(parseBoliviaDate("2026-04-31")).toBeNull(); // abril tiene 30
  });

  it("acepta 29-feb en año bisiesto y lo rechaza en año común", () => {
    expect(parseBoliviaDate("2028-02-29")?.toISOString()).toBe(
      "2028-02-29T04:00:00.000Z",
    );
    expect(parseBoliviaDate("2026-02-29")).toBeNull();
  });
});

describe("parseBoliviaDateTime", () => {
  it("interpreta YYYY-MM-DDTHH:MM como hora-pared Bolivia", () => {
    expect(parseBoliviaDateTime("2026-05-12T09:30")?.toISOString()).toBe(
      "2026-05-12T13:30:00.000Z",
    );
  });

  it("acepta segundos opcionales", () => {
    expect(parseBoliviaDateTime("2026-05-12T09:30:45")?.toISOString()).toBe(
      "2026-05-12T13:30:45.000Z",
    );
  });

  it("rechaza horas/minutos fuera de rango (null, no roll-over)", () => {
    expect(parseBoliviaDateTime("2026-05-12T25:00")).toBeNull();
    expect(parseBoliviaDateTime("2026-05-12T10:60")).toBeNull();
    expect(parseBoliviaDateTime("2026-05-12T09:30:99")).toBeNull();
  });

  it("rechaza días imposibles del mes", () => {
    expect(parseBoliviaDateTime("2026-02-31T10:00")).toBeNull();
    expect(parseBoliviaDateTime("2026-13-01T10:00")).toBeNull();
  });

  it("rechaza formato inválido", () => {
    expect(parseBoliviaDateTime("2026-05-12")).toBeNull(); // sin hora
    expect(parseBoliviaDateTime("2026-05-12 09:30")).toBeNull(); // espacio, no T
    expect(parseBoliviaDateTime("")).toBeNull();
  });
});

describe("inBolivia", () => {
  it("descompone un instante UTC en wall-clock Bolivia", () => {
    expect(inBolivia(new Date("2026-05-12T13:00:00Z"))).toMatchObject({
      year: 2026,
      month: 4, // 0-indexed = mayo
      day: 12,
      weekday: 2, // martes
      hours: 9,
      minutes: 0,
    });
  });

  it("resta el día calendario cuando el instante UTC es de madrugada", () => {
    // 02:00 UTC del 12-may = 22:00 BOT del 11-may (cruza medianoche hacia atrás).
    expect(inBolivia(new Date("2026-05-12T02:00:00Z"))).toMatchObject({
      day: 11,
      hours: 22,
    });
  });
});

describe("toBoliviaDatetimeLocal", () => {
  it("formatea a YYYY-MM-DDTHH:mm en hora Bolivia (zero-padded)", () => {
    const instant = dateInBolivia(2026, 4, 12, 9, 5);
    expect(toBoliviaDatetimeLocal(instant)).toBe("2026-05-12T09:05");
  });

  it("acepta también un ISO string", () => {
    expect(toBoliviaDatetimeLocal("2026-05-12T13:30:00Z")).toBe(
      "2026-05-12T09:30",
    );
  });

  it("round-trip: parse → format → parse es idempotente", () => {
    // Imprescindible para los forms de vigencia (cupones/banners/popups):
    // editar y guardar sin tocar los campos NO debe correr la hora.
    const s = "2026-05-12T09:30";
    const instant = parseBoliviaDateTime(s)!;
    expect(toBoliviaDatetimeLocal(instant)).toBe(s);
    expect(parseBoliviaDateTime(toBoliviaDatetimeLocal(instant))?.toISOString()).toBe(
      instant.toISOString(),
    );
  });
});
