"use server";

import { db } from "@/lib/db";
import { getAvailableSlots, type Slot } from "@/lib/booking/slots";

/**
 * Acción pública para que el storefront pida los slots disponibles de
 * un servicio en una fecha. NO requiere auth — es info pública (igual
 * que el catálogo del producto). El rate limit defensivo vive del lado
 * del checkout/createBookingAction; consultar slots es barato.
 *
 * `storeSlug` es REQUERIDO para que un visitante no pueda enumerar slots
 * de productos de OTRAS tiendas usando un productId adivinado/scrapeado.
 * Antes la action aceptaba solo `productId`, lo que permitía a un
 * competidor consultar la disponibilidad real de cualquier servicio
 * boliviano del SaaS — reconocimiento de carga de negocio rival.
 */
export async function fetchAvailableSlotsAction(
  storeSlug: string,
  productId: string,
  dateYmd: string,
): Promise<Slot[]> {
  // Sanitización mínima
  if (!storeSlug || typeof storeSlug !== "string") return [];
  if (!productId || typeof productId !== "string") return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return [];

  // Verificar que el producto pertenece a la tienda del slug. Sin esto,
  // el caller podía pasar el productId de cualquier tienda y obtener sus
  // slots libres (info competitiva).
  const product = await db.product.findFirst({
    where: {
      id: productId,
      isActive: true,
      isBookable: true,
      store: { slug: storeSlug },
    },
    select: { id: true },
  });
  if (!product) return [];

  return getAvailableSlots(productId, dateYmd);
}
