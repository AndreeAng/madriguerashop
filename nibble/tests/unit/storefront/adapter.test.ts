import { describe, it, expect } from "vitest";
import type { Store, StoreHours } from "@prisma/client";
import { toStoreView, toProductView } from "@/lib/storefront/adapter";

/**
 * El adapter transforma los datos de Prisma al view-model del storefront.
 * Es lógica pura (sin DB): armamos fixtures de objeto plano. Cubre badges,
 * fallbacks de imagen, disponibilidad producto/variante, y el agrupado de
 * horarios (que tenía runs consecutivos y huecos, fácil de romper).
 *
 * tests/setup.ts fuerza TZ=UTC; los casos horarios usan un `now` fijo.
 */

// ---------- Product ----------

type ProductArg = Parameters<typeof toProductView>[0];

function makeProduct(overrides: Record<string, unknown> = {}): ProductArg {
  return {
    id: "p1",
    slug: "prod-1",
    name: "Producto",
    description: null,
    shortDescription: null,
    basePrice: 30,
    comparePrice: null,
    customLabel: null,
    isBestSeller: false,
    isNew: false,
    isActive: true,
    manageStock: false,
    stock: 0,
    isBookable: false,
    hasSchedule: false, // sin ventana horaria → siempre disponible
    availableFrom: null,
    availableTo: null,
    availableDays: [],
    images: [],
    variants: [],
    category: null,
    ...overrides,
  } as unknown as ProductArg;
}

function makeVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: `v${Math.random()}`,
    name: "Variante",
    price: null,
    manageStock: false,
    stock: 0,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe("toProductView — precio y categoría", () => {
  it("convierte basePrice/comparePrice a número y aplica fallback de categoría", () => {
    const v = toProductView(makeProduct({ basePrice: 30, comparePrice: 40 }), "mi-tienda");
    expect(v.price).toBe(30);
    expect(v.comparePrice).toBe(40);
    expect(v.category).toBe("Otros"); // sin category → "Otros"
    expect(v.storeSlug).toBe("mi-tienda");
  });
});

describe("toProductView — badge (prioridad)", () => {
  it("customLabel gana y produce badge 'promo'", () => {
    const v = toProductView(makeProduct({ customLabel: "2x1", isBestSeller: true }), "t");
    expect(v.badge).toBe("promo");
    expect(v.badgeLabel).toBe("2x1");
  });
  it("isBestSeller → 'best' cuando no hay customLabel", () => {
    const v = toProductView(makeProduct({ isBestSeller: true, isNew: true }), "t");
    expect(v.badge).toBe("best");
    expect(v.badgeLabel).toBe("Más vendido");
  });
  it("isNew → 'new'", () => {
    const v = toProductView(makeProduct({ isNew: true }), "t");
    expect(v.badge).toBe("new");
  });
  it("sin flags → sin badge", () => {
    expect(toProductView(makeProduct(), "t").badge).toBeUndefined();
  });
});

describe("toProductView — imagen", () => {
  it("usa la primera imagen si existe", () => {
    const v = toProductView(makeProduct({ images: [{ url: "/u/foto.webp" }] }), "t");
    expect(v.image).toBe("/u/foto.webp");
  });
  it("cae al placeholder local si no hay imágenes", () => {
    expect(toProductView(makeProduct(), "t").image).toBe("/placeholders/product.webp");
  });
});

describe("toProductView — variantes", () => {
  it("filtra inactivas, ordena por sortOrder y calcula priceDelta/available", () => {
    const v = toProductView(
      makeProduct({
        basePrice: 30,
        variants: [
          makeVariant({ name: "B", sortOrder: 2, price: 35, manageStock: true, stock: 0 }),
          makeVariant({ name: "A", sortOrder: 1, price: null, manageStock: false }),
          makeVariant({ name: "Z-inactiva", sortOrder: 0, isActive: false }),
        ],
      }),
      "t",
    );
    expect(v.variants?.map((x) => x.name)).toEqual(["A", "B"]); // ordenadas, sin inactiva
    expect(v.variants?.[0]).toMatchObject({ name: "A", priceDelta: 0, available: true });
    expect(v.variants?.[1]).toMatchObject({ name: "B", priceDelta: 5, available: false });
  });
});

describe("toProductView — disponibilidad", () => {
  it("sin variantes con manageStock y stock 0 → no disponible", () => {
    expect(toProductView(makeProduct({ manageStock: true, stock: 0 }), "t").available).toBe(false);
  });
  it("sin variantes con stock > 0 → disponible", () => {
    expect(toProductView(makeProduct({ manageStock: true, stock: 5 }), "t").available).toBe(true);
  });
  it("con variantes: disponible si AL MENOS UNA lo está", () => {
    const some = toProductView(
      makeProduct({
        variants: [
          makeVariant({ manageStock: true, stock: 0 }),
          makeVariant({ manageStock: true, stock: 3 }),
        ],
      }),
      "t",
    );
    expect(some.available).toBe(true);
  });
  it("con variantes: NO disponible si todas están agotadas", () => {
    const none = toProductView(
      makeProduct({
        variants: [
          makeVariant({ manageStock: true, stock: 0 }),
          makeVariant({ manageStock: true, stock: 0 }),
        ],
      }),
      "t",
    );
    expect(none.available).toBe(false);
  });
  it("producto inactivo → nunca disponible", () => {
    expect(toProductView(makeProduct({ isActive: false, stock: 99 }), "t").available).toBe(false);
  });
});

// ---------- Store ----------

function makeStore(overrides: Record<string, unknown> = {}): Store {
  return {
    slug: "mi-tienda",
    name: "Big Bite Wings",
    description: null,
    city: "Cochabamba",
    vertical: "RESTAURANT",
    whatsappPhone: "+59170000000",
    email: null,
    addressText: null,
    primaryColor: "#000",
    secondaryColor: "#111",
    accentColor: "#f59e0b",
    logoUrl: null,
    bannerUrl: null,
    instagram: null,
    facebook: null,
    tiktok: null,
    website: null,
    acceptsQR: true,
    acceptsCashOnDelivery: true,
    ...overrides,
  } as unknown as Store;
}

function makeHours(
  list: Array<{ dayOfWeek: number; open?: string; close?: string; closed?: boolean }>,
): StoreHours[] {
  return list.map(
    (h) =>
      ({
        id: `h${h.dayOfWeek}`,
        storeId: "s1",
        dayOfWeek: h.dayOfWeek,
        openTime: h.open ?? "09:00",
        closeTime: h.close ?? "21:00",
        isClosed: h.closed ?? false,
      }) as StoreHours,
  );
}

describe("toStoreView — branding y fallbacks", () => {
  it("logoEmoji = iniciales del nombre; banner y descripción tienen fallback", () => {
    const v = toStoreView(makeStore({ name: "Big Bite Wings", description: null }), { hours: [] });
    expect(v.logoEmoji).toBe("BB");
    expect(v.bannerImage).toBe("/placeholders/banner.webp");
    expect(v.description).toBe("Big Bite Wings · Cochabamba");
  });

  it("usa el banner real si está seteado", () => {
    const v = toStoreView(makeStore({ bannerUrl: "/u/banner.webp" }), { hours: [] });
    expect(v.bannerImage).toBe("/u/banner.webp");
  });
});

describe("toStoreView — agrupado de horarios", () => {
  it("agrupa runs consecutivos y separa los que difieren de horario", () => {
    const hours = makeHours([
      { dayOfWeek: 1, open: "09:00", close: "21:00" },
      { dayOfWeek: 2, open: "09:00", close: "21:00" },
      { dayOfWeek: 3, open: "09:00", close: "21:00" },
      { dayOfWeek: 4, open: "09:00", close: "21:00" },
      { dayOfWeek: 5, open: "09:00", close: "21:00" },
      { dayOfWeek: 6, open: "10:00", close: "18:00" },
      { dayOfWeek: 0, closed: true },
    ]);
    const v = toStoreView(makeStore(), { hours });
    expect(v.hoursGroups).toEqual([
      { days: "Lun – Vie", time: "09:00 – 21:00" },
      { days: "Sáb", time: "10:00 – 18:00" },
    ]);
    expect(v.hoursSummary).toBe("Lun – Vie · 09:00 – 21:00 · Sáb · 10:00 – 18:00");
  });

  it("sin días abiertos → 'Cerrado'", () => {
    const v = toStoreView(makeStore(), { hours: makeHours([{ dayOfWeek: 1, closed: true }]) });
    expect(v.hoursGroups).toEqual([]);
    expect(v.hoursSummary).toBe("Cerrado");
  });
});

describe("toStoreView — abierto/cerrado (now inyectado)", () => {
  const weekHours = makeHours([
    { dayOfWeek: 1, open: "09:00", close: "21:00" },
    { dayOfWeek: 2, open: "09:00", close: "21:00" },
    { dayOfWeek: 0, closed: true },
  ]);

  it("lunes 12:00 BOT dentro del horario → abierto, sin próxima apertura", () => {
    const now = new Date("2026-05-11T16:00:00Z"); // 12:00 BOT, lunes
    const v = toStoreView(makeStore(), { hours: weekHours, now });
    expect(v.isOpenNow).toBe(true);
    expect(v.closesTodayAt).toBe("21:00");
    expect(v.nextOpeningLabel).toBeNull();
  });

  it("lunes 22:00 BOT (cerrado) → nextOpeningLabel apunta a mañana", () => {
    const now = new Date("2026-05-12T02:00:00Z"); // 22:00 BOT del lunes
    const v = toStoreView(makeStore(), { hours: weekHours, now });
    expect(v.isOpenNow).toBe(false);
    expect(v.nextOpeningLabel).toBe("Abre mañana a las 09:00");
  });
});
