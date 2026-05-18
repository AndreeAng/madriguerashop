import type {
  Cart,
  CartItem,
  ProductVariant,
} from "@prisma/client";
import type { CartLine } from "@/server/actions/cart";

/**
 * Lógica pura del snapshot del carrito — separada de `server/actions/cart.ts`
 * para que:
 *   1. Los tests unit puedan probar la detección de huérfanos sin mockear
 *      Prisma. El archivo `cart.ts` lleva `"use server"` y solo permite
 *      async function exports.
 *   2. La regla de descarte de items quede en un módulo focalizado, sin
 *      mezclarse con I/O (fetch products) ni side-effects (cleanup).
 *
 * El único caller en producción es `buildSnapshot` de `cart.ts`, que se
 * encarga de la I/O alrededor: fetch productos, lazy cleanup, build URL.
 */

export type CartWithItems = Cart & {
  items: (CartItem & {
    variant: Pick<
      ProductVariant,
      "id" | "name" | "price" | "isActive"
    > | null;
  })[];
};

/**
 * Shape mínimo de producto que `computeCartLines` necesita. Refleja el
 * `select` de `db.product.findMany` en `buildSnapshot`. Tests pueden
 * construirlo sin tocar Prisma.
 */
export type CartProductInfo = {
  id: string;
  name: string;
  slug: string;
  basePrice: number | { toNumber: () => number };
  isActive: boolean;
};

/**
 * Decide qué CartItems entran al snapshot y cuáles son huérfanos. Función
 * PURA — no toca DB, no escribe nada.
 *
 * Reglas de descarte (en orden de evaluación):
 *   1. Producto no encontrado en `productMap` (eliminado o de otra tienda).
 *   2. Producto encontrado pero `isActive=false` (owner lo desactivó).
 *   3. Item tenía `variantId` pero la variante ya no existe en el join.
 *   4. Variante existe pero `isActive=false` (owner la desactivó).
 *
 * El caller (typically `buildSnapshot`) decide qué hacer con `orphanIds`:
 * en producción los borra de DB con `deleteMany` y devuelve `notice=
 * "items_removed"` al cliente para mostrar el banner "el producto cambió,
 * revisa tu carrito".
 */
export function computeCartLines(
  cartItems: CartWithItems["items"],
  productMap: Map<string, CartProductInfo>,
): { lines: CartLine[]; orphanIds: string[]; subtotal: number } {
  let subtotal = 0;
  const lines: CartLine[] = [];
  const orphanIds: string[] = [];

  for (const item of cartItems) {
    const product = productMap.get(item.productId);
    if (!product || !product.isActive) {
      orphanIds.push(item.id);
      continue;
    }
    if (item.variantId !== null && !item.variant) {
      orphanIds.push(item.id);
      continue;
    }
    if (item.variant && item.variant.isActive === false) {
      orphanIds.push(item.id);
      continue;
    }

    const unitPrice = Number(item.unitPrice);
    const variant = item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name,
          price:
            item.variant.price !== null ? Number(item.variant.price) : null,
        }
      : null;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    lines.push({
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      notes: item.notes,
      unitPrice,
      createdAt: item.createdAt,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        basePrice: Number(
          typeof product.basePrice === "number"
            ? product.basePrice
            : product.basePrice.toNumber(),
        ),
      },
      variant,
      lineTotal,
    });
  }

  return { lines, orphanIds, subtotal };
}
