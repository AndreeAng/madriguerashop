"use server";

import { getAvailableSlots, type Slot } from "@/lib/booking/slots";

/**
 * Acción pública para que el storefront pida los slots disponibles de
 * un servicio en una fecha. NO requiere auth — es info pública (igual
 * que el catálogo del producto). El rate limit defensivo vive del lado
 * del checkout/createBookingAction; consultar slots es barato.
 */
export async function fetchAvailableSlotsAction(
  productId: string,
  dateYmd: string,
): Promise<Slot[]> {
  // Sanitización mínima — dateYmd debe ser YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return [];
  return getAvailableSlots(productId, dateYmd);
}
