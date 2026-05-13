/**
 * Geometría para zonas de delivery dibujadas como círculos en mapa.
 *
 * Modelo: cada `DeliveryZone.polygon` (campo Json flexible del schema)
 * guarda `{ type: "circle", lat, lng, radiusMeters }`. Lo elegimos por
 * dos razones:
 *   1. UX: el owner pone un pin + ajusta un slider; mucho más rápido
 *      que dibujar un polígono punto-por-punto.
 *   2. Cobertura real: en Bolivia las zonas de delivery suelen ser
 *      "círculo de X km alrededor del local" — un polígono complejo
 *      es overkill.
 *
 * Futura extensión: cuando algún caller necesite polígonos, agregar
 * `{ type: "polygon", points: [[lat, lng], ...] }` y un branch en
 * `pointInZone`. Por ahora soportamos solo circle.
 */

export type CircleShape = {
  type: "circle";
  lat: number;
  lng: number;
  radiusMeters: number;
};

/** Type guard para el shape "circle". Acepta cualquier `unknown` (es lo que
 *  retorna Prisma para campos `Json`) y devuelve un CircleShape narrow. */
export function readCircleShape(raw: unknown): CircleShape | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type !== "circle") return null;
  const lat = typeof obj.lat === "number" ? obj.lat : null;
  const lng = typeof obj.lng === "number" ? obj.lng : null;
  const radiusMeters =
    typeof obj.radiusMeters === "number" ? obj.radiusMeters : null;
  if (lat === null || lng === null || radiusMeters === null) return null;
  // Sanidad: lat/lng dentro de rango, radio entre 50m y 50km.
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  if (radiusMeters < 50 || radiusMeters > 50_000) return null;
  return { type: "circle", lat, lng, radiusMeters };
}

/**
 * Distancia en metros entre dos puntos lat/lng usando la fórmula
 * haversine. Precisa hasta unos pocos metros para distancias menores
 * a 100km — suficiente para delivery urbano.
 *
 * Referencia: https://en.wikipedia.org/wiki/Haversine_formula
 */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** True si (lat, lng) cae dentro del círculo definido por `shape`. */
function pointInCircle(
  lat: number,
  lng: number,
  shape: CircleShape,
): boolean {
  return haversineMeters(lat, lng, shape.lat, shape.lng) <= shape.radiusMeters;
}

/**
 * Devuelve la PRIMERA zona cuya forma contiene (lat, lng), prefiriendo
 * la de menor radio entre las que cubren — heurística: si dos zonas se
 * superponen, la más chica es más específica y suele tener fee distinto
 * (ej. zona pequeña = más cerca = más barata).
 */
export function findMatchingZone<T extends { id: string; polygon: unknown }>(
  zones: T[],
  lat: number,
  lng: number,
): T | null {
  let best: { zone: T; radius: number } | null = null;
  for (const z of zones) {
    const shape = readCircleShape(z.polygon);
    if (!shape) continue;
    if (!pointInCircle(lat, lng, shape)) continue;
    if (!best || shape.radiusMeters < best.radius) {
      best = { zone: z, radius: shape.radiusMeters };
    }
  }
  return best?.zone ?? null;
}
