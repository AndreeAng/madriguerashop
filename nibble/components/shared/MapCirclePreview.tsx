"use client";

import { Circle, MapContainer, TileLayer } from "react-leaflet";

/**
 * Preview pequeño y NO interactivo de un círculo de cobertura. Ideal
 * para listas — el owner ve de un vistazo el área de la zona sin entrar
 * a editarla.
 *
 * Bloqueamos zoom + drag + click para que no compita con el resto de la
 * UI. El zoom inicial se calcula a partir del radio para que el círculo
 * llene cómodamente la viewport del preview.
 */
export function MapCirclePreview({
  lat,
  lng,
  radiusMeters,
  size = 96,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  /** Lado del cuadrado en px. */
  size?: number;
}) {
  // Zoom según radio para que el círculo ocupe ~70% del preview.
  // Aproximación: a zoom Z, 1 píxel ≈ (40075000 / 256 / 2^Z) m a ecuador.
  // Queremos que radius*2 ≈ size*0.7 píxeles → resolvemos para Z.
  // Para Cochabamba (~17° lat), el factor de corrección por latitud
  // se mantiene casi 1, así que usamos la fórmula del ecuador.
  const wantedPxPerMeter = (size * 0.7) / (radiusMeters * 2);
  const zoom = Math.max(
    8,
    Math.min(17, Math.log2(40_075_000 / 256 / (1 / wantedPxPerMeter))),
  );

  return (
    <div
      style={{ width: size, height: size }}
      className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--bg)]"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "transparent" }}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle
          center={[lat, lng]}
          radius={radiusMeters}
          pathOptions={{
            color: "#dc2626",
            fillColor: "#dc2626",
            fillOpacity: 0.25,
            weight: 2,
          }}
        />
      </MapContainer>
    </div>
  );
}
