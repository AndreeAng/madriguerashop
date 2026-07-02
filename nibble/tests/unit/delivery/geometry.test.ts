import { describe, it, expect } from "vitest";
import {
  readCircleShape,
  findMatchingZone,
} from "@/lib/delivery/geometry";

// El fee de envío se resuelve por geometría: qué zona (círculo) cubre el
// pin del cliente. Un bug acá cobra de más/de menos, o deja pasar pedidos
// fuera de cobertura. `polygon` viene como Json de Prisma (unknown), por eso
// readCircleShape valida defensivamente.

// A 0.01° de latitud ≈ 1113 m. Usamos el ecuador (0,0) para razonar distancias.
const AT = (lat: number, lng: number) => ({ lat, lng });

describe("readCircleShape — validación defensiva del Json", () => {
  it("acepta un círculo válido", () => {
    expect(
      readCircleShape({ type: "circle", lat: -17.39, lng: -66.16, radiusMeters: 2000 }),
    ).toEqual({ type: "circle", lat: -17.39, lng: -66.16, radiusMeters: 2000 });
  });

  it("rechaza tipo distinto de circle", () => {
    expect(readCircleShape({ type: "polygon", points: [] })).toBeNull();
  });

  it("rechaza null / no-objeto", () => {
    expect(readCircleShape(null)).toBeNull();
    expect(readCircleShape("circle")).toBeNull();
    expect(readCircleShape(42)).toBeNull();
  });

  it("rechaza campos faltantes o no numéricos", () => {
    expect(readCircleShape({ type: "circle", lat: -17, lng: -66 })).toBeNull();
    expect(
      readCircleShape({ type: "circle", lat: "x", lng: -66, radiusMeters: 1000 }),
    ).toBeNull();
  });

  it("rechaza lat/lng fuera de rango", () => {
    expect(readCircleShape({ type: "circle", lat: 91, lng: 0, radiusMeters: 1000 })).toBeNull();
    expect(readCircleShape({ type: "circle", lat: 0, lng: 181, radiusMeters: 1000 })).toBeNull();
  });

  it("rechaza radios absurdos (<50m o >50km)", () => {
    expect(readCircleShape({ type: "circle", lat: 0, lng: 0, radiusMeters: 10 })).toBeNull();
    expect(readCircleShape({ type: "circle", lat: 0, lng: 0, radiusMeters: 60_000 })).toBeNull();
  });
});

describe("findMatchingZone", () => {
  const circle = (id: string, lat: number, lng: number, radiusMeters: number) => ({
    id,
    polygon: { type: "circle", lat, lng, radiusMeters },
  });

  it("devuelve la zona que contiene el punto", () => {
    const zones = [circle("z1", 0, 0, 1000)];
    const match = findMatchingZone(zones, AT(0, 0).lat, AT(0, 0).lng);
    expect(match?.id).toBe("z1");
  });

  it("devuelve null si el punto cae fuera de toda zona", () => {
    const zones = [circle("z1", 0, 0, 1000)];
    // (0.02, 0) ≈ 2226 m del centro → fuera del radio de 1000 m.
    expect(findMatchingZone(zones, 0.02, 0)).toBeNull();
  });

  it("un punto justo dentro del radio matchea; justo fuera, no", () => {
    const zones = [circle("z1", 0, 0, 1000)];
    // (0.005, 0) ≈ 556 m → dentro de 1000 m.
    expect(findMatchingZone(zones, 0.005, 0)?.id).toBe("z1");
    // (0.011, 0) ≈ 1224 m → fuera de 1000 m.
    expect(findMatchingZone(zones, 0.011, 0)).toBeNull();
  });

  it("con zonas superpuestas prefiere la de MENOR radio (más específica)", () => {
    const zones = [
      circle("grande", 0, 0, 5000),
      circle("chica", 0, 0, 1000),
    ];
    // El punto cae en ambas; debe ganar la chica (fee más específico).
    expect(findMatchingZone(zones, 0, 0)?.id).toBe("chica");
  });

  it("ignora zonas con polygon inválido", () => {
    const zones = [
      { id: "rota", polygon: { type: "polygon" } },
      circle("valida", 0, 0, 1000),
    ];
    expect(findMatchingZone(zones, 0, 0)?.id).toBe("valida");
  });

  it("devuelve null con lista vacía", () => {
    expect(findMatchingZone([], 0, 0)).toBeNull();
  });
});
