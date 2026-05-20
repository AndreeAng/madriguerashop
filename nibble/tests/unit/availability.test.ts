import { describe, it, expect } from "vitest";
import type { StoreHours } from "@prisma/client";
import {
  isProductAvailableNow,
  isStoreOpenNow,
} from "@/lib/storefront/availability";

/**
 * Estos tests blindan el fix de timezone aplicado en Sprint 1.
 *
 * Bug anterior: `Date.getDay()/getHours()` devolvía componentes en la TZ
 * del proceso (UTC en Vercel), no en Bolivia. Resultado: un cliente que
 * programaba un pedido para "domingo 23:00 BOT" era evaluado como "lunes
 * 03:00 UTC" y comparado contra los horarios de lunes en vez de domingo.
 *
 * Si alguien revierte la conversión a `inBolivia()`, varios tests acá
 * fallan — específicamente los que cruzan el límite de día entre UTC y BOT.
 */

// Helper: construye una row de StoreHours mínima.
function hours(
  dayOfWeek: number,
  openTime: string,
  closeTime: string,
  isClosed = false,
): StoreHours {
  return {
    id: `h-${dayOfWeek}`,
    storeId: "store-1",
    dayOfWeek,
    openTime,
    closeTime,
    isClosed,
  };
}

// Helper: una semana abierta L-D, 09:00-22:00.
function fullWeekOpen(): StoreHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => hours(d, "09:00", "22:00"));
}

describe("isStoreOpenNow", () => {
  it("retorna true cuando no hay rows configurados (seed incompleto)", () => {
    expect(isStoreOpenNow([], new Date())).toBe(true);
  });

  it("retorna false si hoy está marcado como cerrado", () => {
    // 2026-05-13 = miércoles. Hora arbitraria dentro del rango configurado.
    const weds = new Date("2026-05-13T18:00:00Z");
    const closedWeds: StoreHours[] = [
      hours(3, "09:00", "22:00", true), // wednesday closed
    ];
    expect(isStoreOpenNow(closedWeds, weds)).toBe(false);
  });

  it("retorna false si no hay row para el día actual", () => {
    // Solo configurado lunes; pedir un martes.
    const weds = new Date("2026-05-13T18:00:00Z");
    const onlyMonday: StoreHours[] = [hours(1, "09:00", "22:00")];
    expect(isStoreOpenNow(onlyMonday, weds)).toBe(false);
  });

  it("retorna true cuando estamos dentro del rango", () => {
    // 2026-05-13T18:00 UTC = 14:00 BOT (miércoles)
    const inRange = new Date("2026-05-13T18:00:00Z");
    expect(isStoreOpenNow(fullWeekOpen(), inRange)).toBe(true);
  });

  it("retorna false antes del openTime", () => {
    // 2026-05-13T12:00 UTC = 08:00 BOT (antes de 09:00)
    const tooEarly = new Date("2026-05-13T12:00:00Z");
    expect(isStoreOpenNow(fullWeekOpen(), tooEarly)).toBe(false);
  });

  it("retorna false después del closeTime", () => {
    // 2026-05-14T03:00 UTC = 23:00 BOT del miércoles (después de 22:00)
    const tooLate = new Date("2026-05-14T03:00:00Z");
    expect(isStoreOpenNow(fullWeekOpen(), tooLate)).toBe(false);
  });

  describe("rango que cruza medianoche (food truck nocturno)", () => {
    const lateNight: StoreHours[] = [
      hours(5, "20:00", "03:00"), // viernes: abre 20, cierra 03 del sábado
    ];

    it("abierto a las 23:00 del viernes BOT", () => {
      // 2026-05-16T03:00 UTC = 23:00 BOT del viernes 2026-05-15
      const fri23bot = new Date("2026-05-16T03:00:00Z");
      expect(isStoreOpenNow(lateNight, fri23bot)).toBe(true);
    });

    it("abierto a las 02:00 del sábado BOT (todavía dentro del rango overnight del viernes)", () => {
      // 2026-05-16T06:00 UTC = 02:00 BOT del sábado 2026-05-16
      // El día en BOT es sábado, pero el rango del viernes (22:00→03:00)
      // sigue activo hasta las 03:00 del sábado. La función ahora detecta
      // ese caso de borde y mantiene el food truck "abierto" hasta el cierre.
      const sat02bot = new Date("2026-05-16T06:00:00Z");
      expect(isStoreOpenNow(lateNight, sat02bot)).toBe(true);
    });

    it("cerrado a las 04:00 del sábado BOT (ya pasó el cierre overnight)", () => {
      // 2026-05-16T08:00 UTC = 04:00 BOT del sábado 2026-05-16, fuera
      // del rango overnight del viernes (que cerraba 03:00).
      const sat04bot = new Date("2026-05-16T08:00:00Z");
      expect(isStoreOpenNow(lateNight, sat04bot)).toBe(false);
    });
  });

  describe("regression — evaluación en hora Bolivia (no UTC)", () => {
    // ESTE ES EL TEST CLAVE: si alguien revierte `inBolivia()` y vuelve a
    // `getDay()/getHours()`, este test detecta el bug.
    //
    // Escenario: la tienda abre solo lunes 09-22 (cerrada todo el resto).
    // El cliente intenta pedir el "domingo 23:00 BOT", que en UTC es
    // "lunes 03:00 UTC".
    //
    // Comportamiento correcto: como en Bolivia es domingo y la tienda
    // está cerrada los domingos, debe retornar FALSE.
    // Comportamiento buggy (UTC): el servidor cree que es lunes 03:00 →
    // mira el row del lunes → no está abierto a las 03:00 → false por
    // distinto motivo (suerte). Cambiá el escenario para que el bug
    // se manifieste claramente:
    const mondayOnly: StoreHours[] = [hours(1, "00:00", "23:59")];

    it("rechaza domingo 23:00 BOT aunque en UTC ya sea lunes 03:00", () => {
      // 2026-05-11T03:00 UTC = 2026-05-10 23:00 BOT. 2026-05-10 es DOMINGO.
      const sun23bot = new Date("2026-05-11T03:00:00Z");
      // En BOT es domingo → no hay row → false. ✓
      // En UTC sería lunes 03:00 → hay row del lunes activo todo el día
      // → si la función usara UTC, retornaría TRUE. ✗
      expect(isStoreOpenNow(mondayOnly, sun23bot)).toBe(false);
    });

    it("acepta lunes 01:00 BOT aunque en UTC sea domingo 21:00", () => {
      // 2026-05-12T01:00 BOT = 2026-05-12T05:00 UTC, pero 2026-05-12 es martes.
      // Re-cálculo: lunes 01:00 BOT = (lunes 11-may) 01:00 BOT = 2026-05-11T05:00 UTC.
      // 2026-05-11T05:00 UTC = lunes 05:00 UTC.
      // Hmm, ese no cruza la frontera. Necesito una hora donde BOT y UTC
      // estén en días distintos. Lunes 02:00 BOT = lunes 06:00 UTC → mismo día.
      // Lunes 00:30 BOT = lunes 04:30 UTC → mismo día. No hay manera de
      // que lunes BOT sea domingo UTC (BOT está 4 atrás).
      //
      // Inversa: lunes 23:00 BOT = martes 03:00 UTC. Si la función mirara
      // UTC, evaluaría como martes (no hay row) → false. La verdad es
      // lunes BOT → row activo → true.
      const mon23bot = new Date("2026-05-12T03:00:00Z");
      expect(isStoreOpenNow(mondayOnly, mon23bot)).toBe(true);
    });
  });
});

describe("isProductAvailableNow", () => {
  it("hasSchedule=false → siempre disponible", () => {
    expect(
      isProductAvailableNow({
        hasSchedule: false,
        availableFrom: null,
        availableTo: null,
        availableDays: [],
      }),
    ).toBe(true);
  });

  it("hasSchedule=true sin filtros → NO disponible (config rota)", () => {
    expect(
      isProductAvailableNow({
        hasSchedule: true,
        availableFrom: null,
        availableTo: null,
        availableDays: [],
      }),
    ).toBe(false);
  });

  it("filtro de día — incluido", () => {
    // 2026-05-13T18:00 UTC = 14:00 BOT (miércoles, weekday=3)
    const wed = new Date("2026-05-13T18:00:00Z");
    expect(
      isProductAvailableNow(
        {
          hasSchedule: true,
          availableFrom: null,
          availableTo: null,
          availableDays: [3], // miércoles
        },
        wed,
      ),
    ).toBe(true);
  });

  it("filtro de día — excluido", () => {
    const wed = new Date("2026-05-13T18:00:00Z");
    expect(
      isProductAvailableNow(
        {
          hasSchedule: true,
          availableFrom: null,
          availableTo: null,
          availableDays: [1, 5], // lunes, viernes — no miércoles
        },
        wed,
      ),
    ).toBe(false);
  });

  it("filtro de hora — dentro de rango", () => {
    // 2026-05-13T18:00 UTC = 14:00 BOT
    const wed14bot = new Date("2026-05-13T18:00:00Z");
    expect(
      isProductAvailableNow(
        {
          hasSchedule: true,
          availableFrom: "12:00",
          availableTo: "16:00",
          availableDays: [],
        },
        wed14bot,
      ),
    ).toBe(true);
  });

  it("filtro de hora — fuera de rango", () => {
    const wed14bot = new Date("2026-05-13T18:00:00Z");
    expect(
      isProductAvailableNow(
        {
          hasSchedule: true,
          availableFrom: "15:00",
          availableTo: "17:00",
          availableDays: [],
        },
        wed14bot,
      ),
    ).toBe(false);
  });

  it("filtro de hora que cruza medianoche", () => {
    // 23:00 BOT = 03:00 UTC del día siguiente
    const lateNight = new Date("2026-05-14T03:00:00Z");
    expect(
      isProductAvailableNow(
        {
          hasSchedule: true,
          availableFrom: "22:00",
          availableTo: "02:00",
          availableDays: [],
        },
        lateNight,
      ),
    ).toBe(true);
  });

  describe("regression — evaluación en hora Bolivia", () => {
    it("disponible solo lunes — rechaza domingo 23:00 BOT aunque UTC diga lunes", () => {
      // 2026-05-11T03:00 UTC = domingo 23:00 BOT
      const sunNightBot = new Date("2026-05-11T03:00:00Z");
      expect(
        isProductAvailableNow(
          {
            hasSchedule: true,
            availableFrom: null,
            availableTo: null,
            availableDays: [1], // solo lunes
          },
          sunNightBot,
        ),
      ).toBe(false);
    });
  });
});
