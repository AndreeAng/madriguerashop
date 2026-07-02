"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";

// Mismo pin SVG que los otros mapas: rojo para que se distinga del fondo
// del círculo de cobertura.
const PIN_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#dc2626"/>
  <circle cx="16" cy="16" r="6" fill="white"/>
</svg>
`)}`;
const PIN_ICON = L.icon({
  iconUrl: PIN_SVG,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
});

const COCHABAMBA: [number, number] = [-17.3935, -66.157];

function MapEvents({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Re-centra el mapa cuando el centro del círculo cambia externamente
 * (ej. "Usar mi ubicación"). Sin esto, el círculo aparece pero el mapa
 * queda donde estaba.
 */
function RecenterOnCenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!center) return;
    const key = `${center[0]},${center[1]}`;
    if (lastRef.current === key) return;
    lastRef.current = key;
    map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [center, map]);
  return null;
}

/**
 * Editor de zona en mapa: click/drag para mover el centro, slider para
 * ajustar el radio. Inputs ocultos `centerLat`, `centerLng`, `radiusMeters`
 * para que un `<form>` parent reciba los valores sin extra wiring.
 *
 * Los inputs son SIEMPRE controlados aunque el usuario no haya tocado
 * nada — el server action distingue "los 3 vacíos" como "sin shape".
 */
export function MapZoneEditor({
  initialLat,
  initialLng,
  initialRadiusMeters,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  initialRadiusMeters?: number | null;
}) {
  const [center, setCenter] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null,
  );
  const [radius, setRadius] = useState<number>(initialRadiusMeters ?? 1500);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no soporta geolocalización.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso denegado. Toca el mapa para marcar el centro manualmente."
            : "No pudimos obtener tu ubicación.",
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  // Display friendly: <1km en metros, ≥1km en km con un decimal.
  const radiusLabel =
    radius < 1000
      ? `${Math.round(radius)} m`
      : `${(radius / 1000).toFixed(1)} km`;

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="centerLat"
        value={center ? center[0] : ""}
      />
      <input
        type="hidden"
        name="centerLng"
        value={center ? center[1] : ""}
      />
      <input
        type="hidden"
        name="radiusMeters"
        value={center ? Math.round(radius) : ""}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[color:var(--muted)]">
          Toca el mapa donde está tu local. El círculo es el área de cobertura.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--card)] px-3 py-1 text-xs font-medium hover:border-[color:var(--color-bark-300)] disabled:opacity-50"
        >
          <Navigation className="size-3.5" />
          {geoLoading ? "Buscando…" : "Usar mi ubicación"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--line)]">
        <MapContainer
          center={center ?? COCHABAMBA}
          zoom={center ? 14 : 12}
          style={{ height: 280, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapEvents onPick={(lat, lng) => setCenter([lat, lng])} />
          <RecenterOnCenter center={center} />
          {center && (
            <>
              <Circle
                center={center}
                radius={radius}
                pathOptions={{
                  color: "#dc2626",
                  fillColor: "#dc2626",
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
              <Marker
                position={center}
                draggable
                icon={PIN_ICON}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    setCenter([lat, lng]);
                  },
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {center ? (
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-[color:var(--fg-soft)]">
              Radio de cobertura
            </span>
            <span className="num-tabular text-sm font-semibold">
              {radiusLabel}
            </span>
          </div>
          <input
            type="range"
            min={200}
            max={50000}
            step={100}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-2 w-full accent-[color:var(--color-tomato-600)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[color:var(--muted)]">
            <span>200 m</span>
            <span>50 km</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[color:var(--muted)]">
          Marca un punto en el mapa para empezar a definir el área.
        </p>
      )}

      {geoError && (
        <p role="alert" className="text-xs text-[color:var(--color-tomato-600)]">
          {geoError}
        </p>
      )}
    </div>
  );
}
