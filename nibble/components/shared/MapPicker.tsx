"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation } from "lucide-react";

// ============== Fix de icono default de Leaflet ==============
// Leaflet busca su PNG de pin en una URL relativa al CSS que no funciona en
// bundlers modernos (Vite/Turbopack). Sin este fix el pin aparece roto.
// Usamos una versión SVG via data-URL para que no dependa de archivos.
const PIN_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#dc2626"/>
  <circle cx="16" cy="16" r="6" fill="white"/>
</svg>
`)}`;
const DEFAULT_ICON = L.icon({
  iconUrl: PIN_SVG,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -42],
});

// Centro de Cochabamba — fallback cuando el cliente no comparte ubicación.
// Si tu mercado crece, esto podría venir de la `Store` (lat/lng de la sede).
const COCHABAMBA: [number, number] = [-17.3935, -66.157];

/**
 * Hook interno: maneja clicks/drag del mapa para mover el pin. Vive
 * adentro del MapContainer porque `useMap` y `useMapEvents` requieren
 * el contexto de Leaflet.
 */
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

/** Helper para que el mapa se re-centre cuando cambia el punto externamente
 *  (ej. tras "usar mi ubicación"). */
function RecenterOnPoint({ point }: { point: [number, number] | null }) {
  const map = useMap();
  const lastRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!point) return;
    const [lat, lng] = point;
    if (lastRef.current && lastRef.current[0] === lat && lastRef.current[1] === lng) {
      return;
    }
    lastRef.current = [lat, lng];
    map.flyTo(point, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [point, map]);
  return null;
}

/**
 * Mapa interactivo para que el cliente marque su ubicación en checkout.
 * - Centro default: Cochabamba. Si el cliente permite geolocation, se
 *   centra ahí automáticamente.
 * - Pin draggable + click en el mapa lo mueve.
 * - Los valores actuales se exponen vía `onChange(lat, lng)` y se
 *   reflejan en inputs `name="deliveryLat"`/`"deliveryLng"` para que
 *   un `<form>` parent los reciba sin extra wiring.
 */
export function MapPicker({
  initialLat,
  initialLng,
  onChange,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange?: (lat: number, lng: number) => void;
}) {
  const [point, setPoint] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null,
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function setPick(lat: number, lng: number) {
    setPoint([lat, lng]);
    onChange?.(lat, lng);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no soporta geolocalización.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPick(pos.coords.latitude, pos.coords.longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Marcá el punto manualmente en el mapa."
            : "No pudimos obtener tu ubicación. Marcala manualmente.",
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[color:var(--muted)]">
          Tocá el mapa o usá tu ubicación actual para marcar dónde entregar.
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

      {/* Inputs ocultos para que un <form> padre reciba lat/lng sin extra wiring. */}
      <input type="hidden" name="deliveryLat" value={point ? point[0] : ""} />
      <input type="hidden" name="deliveryLng" value={point ? point[1] : ""} />

      <div className="overflow-hidden rounded-xl border border-[color:var(--line)]">
        <MapContainer
          center={point ?? COCHABAMBA}
          zoom={point ? 16 : 13}
          style={{ height: 280, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            // OSM público: gratis y sin API key. Atribución obligatoria por
            // licencia ODbL — Leaflet la pinta en la esquina inferior derecha.
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapEvents onPick={setPick} />
          <RecenterOnPoint point={point} />
          {point && (
            <Marker
              position={point}
              draggable
              icon={DEFAULT_ICON}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  setPick(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {point ? (
        <p className="flex items-center gap-1.5 text-xs text-[color:var(--color-leaf-700)]">
          <MapPin className="size-3.5" />
          Ubicación marcada — {point[0].toFixed(5)}, {point[1].toFixed(5)}
        </p>
      ) : (
        <p className="text-xs text-[color:var(--muted)]">
          Sin ubicación marcada. Es opcional pero ayuda al repartidor.
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
