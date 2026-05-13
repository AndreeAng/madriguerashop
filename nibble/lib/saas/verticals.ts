import type { StoreVertical } from "@prisma/client";

/**
 * Labels visibles del enum `StoreVertical`. Fuente única para la UI;
 * cualquier vertical nueva se agrega acá y aparece automáticamente en
 * /admin/tiendas, /admin/plantillas, /admin/analytics y /tiendas.
 */
export const VERTICAL_LABELS: Record<StoreVertical, string> = {
  RESTAURANT: "Restaurante",
  FOOD_TRUCK: "Food truck",
  BAKERY: "Panadería / Pastelería",
  GROCERY: "Almacén / Abarrotes",
  RETAIL: "Retail / Moda",
  HARDWARE: "Ferretería",
  BEAUTY: "Belleza y estética",
  HEALTH: "Farmacia / Salud",
  SERVICES: "Servicios",
  OTHER: "Otro rubro",
};

/** Devuelve el label legible para una vertical, con fallback al valor crudo. */
export function verticalLabel(vertical: string): string {
  return VERTICAL_LABELS[vertical as StoreVertical] ?? vertical;
}
