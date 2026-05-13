"use client";

import { useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

/**
 * Mapa de densidad de pedidos. En vez de usar `leaflet.heat` (plugin
 * extra que toca pintarlo con un canvas) clusterizamos por celdas de
 * ~50m × 50m y dibujamos `CircleMarker` con radio proporcional al
 * conteo. Resultado equivalente al heatmap clásico, sin librería extra.
 *
 * Las opacidades se acumulan visualmente — varios pedidos en el mismo
 * lugar producen un punto más opaco y grande. Eso es exactamente lo
 * que el merchant necesita: "dónde concentro entregas".
 */
export function MapDensity({
  points,
  height = 360,
}: {
  points: { lat: number; lng: number }[];
  height?: number;
}) {
  // Center + bounds: si hay puntos, calculamos el promedio + un zoom que
  // los cubra a todos. Sin puntos, fallback a Cochabamba.
  const { center, zoom, clusters } = useMemo(() => {
    if (points.length === 0) {
      return {
        center: [-17.3935, -66.157] as [number, number],
        zoom: 12,
        clusters: [] as { lat: number; lng: number; count: number }[],
      };
    }
    // Cluster por celdas de ~50m. Lat: 1° ≈ 111km → 50m ≈ 0.00045°.
    // Lng en Cochabamba: 1° ≈ 106km → 50m ≈ 0.00047°. Usamos un solo
    // step de 0.0005° que suficiente para densidad visual.
    const STEP = 0.0005;
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    let sumLat = 0;
    let sumLng = 0;
    for (const p of points) {
      const gridLat = Math.round(p.lat / STEP) * STEP;
      const gridLng = Math.round(p.lng / STEP) * STEP;
      const key = `${gridLat.toFixed(5)},${gridLng.toFixed(5)}`;
      const existing = grid.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grid.set(key, { lat: gridLat, lng: gridLng, count: 1 });
      }
      sumLat += p.lat;
      sumLng += p.lng;
    }
    const cx = sumLat / points.length;
    const cy = sumLng / points.length;
    return {
      center: [cx, cy] as [number, number],
      zoom: 13,
      clusters: Array.from(grid.values()),
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] text-sm text-[color:var(--muted)]">
        Aún no hay pedidos con ubicación marcada en este período.
      </div>
    );
  }

  const maxCount = Math.max(...clusters.map((c) => c.count));

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--line)]">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {clusters.map((c) => {
          // Radio en píxeles: 6px base + hasta 18 extra según densidad.
          const radius = 6 + (c.count / maxCount) * 18;
          return (
            <CircleMarker
              key={`${c.lat}-${c.lng}`}
              center={[c.lat, c.lng]}
              radius={radius}
              pathOptions={{
                color: "transparent",
                fillColor: "#dc2626",
                fillOpacity: 0.35 + (c.count / maxCount) * 0.4,
              }}
            >
              <title>{c.count} pedido{c.count === 1 ? "" : "s"} en este punto</title>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
