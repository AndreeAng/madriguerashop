"use client";

import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { ExternalLink } from "lucide-react";

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
});

/**
 * Mapa de SOLO LECTURA con un único pin. Para el detalle del pedido:
 * el merchant ve dónde es la entrega + abre la ruta en su app preferida
 * (Google Maps / Waze) con el botón inferior.
 *
 * Si el navegador no soporta deep links nativos, Google Maps web
 * funciona como fallback.
 */
export function MapView({
  lat,
  lng,
  height = 240,
}: {
  lat: number;
  lng: number;
  height?: number;
}) {
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-[color:var(--line)]">
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          style={{ height, width: "100%" }}
          scrollWheelZoom={false}
          dragging
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={[lat, lng]} icon={DEFAULT_ICON} />
        </MapContainer>
      </div>
      <a
        href={gmapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-bark-900)] px-4 py-2 text-xs font-medium text-white hover:bg-[color:var(--color-bark-700)]"
      >
        Abrir ruta en Google Maps <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
