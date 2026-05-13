"use client";

import dynamic from "next/dynamic";

/**
 * Wrappers dinámicos de los componentes Leaflet. Leaflet ejecuta código que
 * toca `window` al cargarse — si lo importamos directo desde un Server
 * Component o desde el render SSR de un Client Component, revienta con
 * "ReferenceError: window is not defined". `next/dynamic` con `ssr: false`
 * fuerza carga solo en cliente.
 *
 * Pattern: TODOS los callers (RSC o CC) importan desde este archivo, no
 * desde `MapPicker.tsx` / `MapView.tsx` / `MapDensity.tsx` directamente.
 */

export const MapPicker = dynamic(
  () => import("./MapPicker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] text-sm text-[color:var(--muted)]">
        Cargando mapa…
      </div>
    ),
  },
);

export const MapView = dynamic(
  () => import("./MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] text-sm text-[color:var(--muted)]">
        Cargando mapa…
      </div>
    ),
  },
);

export const MapDensity = dynamic(
  () => import("./MapDensity").then((m) => m.MapDensity),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] text-sm text-[color:var(--muted)]">
        Cargando mapa…
      </div>
    ),
  },
);

export const MapZoneEditor = dynamic(
  () => import("./MapZoneEditor").then((m) => m.MapZoneEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] text-sm text-[color:var(--muted)]">
        Cargando editor de zona…
      </div>
    ),
  },
);

export const MapCirclePreview = dynamic(
  () => import("./MapCirclePreview").then((m) => m.MapCirclePreview),
  {
    ssr: false,
    // Sin loading placeholder: el preview es chico (96px) y un skeleton
    // ruidoso en cada row de la lista de zonas distrae más que aporta.
    loading: () => null,
  },
);
