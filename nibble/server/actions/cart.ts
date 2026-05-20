"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ensureGuestToken, readGuestToken } from "@/lib/cart/cookies";
import { getStoreBySlug } from "@/lib/tenant/resolve";
import { isProductAvailableNow } from "@/lib/storefront/availability";
import {
  computeCartLines,
  type CartProductInfo,
  type CartWithItems,
} from "@/lib/cart/snapshot";

// ============== Types ==============

// El snapshot del cart cruza la frontera Server→Client (CheckoutForm,
// StorefrontHeader). Prisma `Decimal` NO es serializable por RSC, así que
// los precios viven como `number` ya convertidos en server. No extender
// `CartItem` crudo de Prisma — eso reintroduce el Decimal por la puerta
// de atrás.
export type CartLine = {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  notes: string | null;
  unitPrice: number;
  createdAt: Date;
  product: { id: string; name: string; slug: string; basePrice: number };
  variant: { id: string; name: string; price: number | null } | null;
  lineTotal: number;
};

/**
 * `notice` se setea cuando `buildSnapshot` descarta líneas del cart porque
 * el producto/variante referenciado ya no existe o quedó inactivo. La UI
 * muestra el mensaje "el producto cambió, revisa tu carrito" y se asume
 * que el cliente ya vio el cart "purgado". Las líneas afectadas se borran
 * también del DB (lazy cleanup) para que el flag no se reactive en cada
 * lectura sucesiva.
 */
export type CartNotice = "items_removed";

export type CartSnapshot = {
  cartId: string;
  storeId: string;
  storeSlug: string;
  items: CartLine[];
  subtotal: number;
  itemCount: number;
  notice: CartNotice | null;
};

// Alineado con la TTL de `nibble_guest_token` (30 días) para que el cliente
// que vuelve día 8-29 con la cookie intacta encuentre su carrito en DB.
// Antes el carrito expiraba a 7d y la cookie a 30d → mismatch silencioso:
// la UI mostraba carrito vacío sin mensaje.
const CART_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

// ============== Helpers internos ==============

async function getOrCreateCart(storeId: string, storeSlug: string) {
  const guestToken = await ensureGuestToken();

  // Buscamos un carrito vivo para este guestToken+store
  const existing = await db.cart.findFirst({
    where: { storeId, guestToken, expiresAt: { gt: new Date() } },
    include: cartIncludeShape,
  });

  if (existing) return { cart: existing, guestToken, storeSlug };

  // Crear uno nuevo
  const fresh = await db.cart.create({
    data: {
      storeId,
      guestToken,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: cartIncludeShape,
  });

  return { cart: fresh, guestToken, storeSlug };
}

const cartIncludeShape = {
  items: {
    include: {
      // `isActive` se incluye para que `buildSnapshot` descarte variantes
      // que el owner desactivó (pero no borró) sin tener que hacer otra
      // query — sin esto un cart podía mostrar una variante "fantasma"
      // que ya no se vende.
      variant: {
        select: { id: true, name: true, price: true, isActive: true },
      },
    },
  },
} as const;

async function buildSnapshot(
  cart: CartWithItems,
  storeSlug: string,
): Promise<CartSnapshot> {
  // Fetch product info para todos los items en una sola query.
  // Filtramos por storeId para aislamiento multi-tenant: si por cualquier
  // inconsistencia un CartItem apunta a un productId de OTRA tienda, no
  // queremos materializar ese producto en el snapshot ni cobrarlo.
  // `isActive` se trae para descartar productos que el owner desactivó.
  const productIds = Array.from(new Set(cart.items.map((i) => i.productId)));
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, storeId: cart.storeId },
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          isActive: true,
        },
      })
    : [];
  const productMap = new Map<string, CartProductInfo>(
    products.map((p) => [p.id, p]),
  );

  const { lines, orphanIds, subtotal } = computeCartLines(
    cart.items,
    productMap,
  );

  // Lazy cleanup: borramos los items huérfanos de la DB para que el
  // notice no se quede pegado en lecturas sucesivas. Best-effort: si
  // falla, el snapshot ya está correcto y la próxima lectura limpiará.
  if (orphanIds.length > 0) {
    db.cartItem
      .deleteMany({ where: { id: { in: orphanIds } } })
      .catch((err) =>
        console.error("[cart] orphan cleanup failed", err),
      );
  }

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    cartId: cart.id,
    storeId: cart.storeId,
    storeSlug,
    items: lines,
    subtotal,
    itemCount,
    notice: orphanIds.length > 0 ? "items_removed" : null,
  };
}

// ============== Public Server Actions ==============

const addItemSchema = z.object({
  storeSlug: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive().max(99),
  notes: z.string().max(500).optional().nullable(),
});

export async function addItemToCart(input: z.input<typeof addItemSchema>) {
  const data = addItemSchema.parse(input);

  const store = await getStoreBySlug(data.storeSlug);
  if (!store) throw new Error("Tienda no encontrada");

  // Validar producto y precio (no confiamos del cliente). Traemos también
  // `storeHours` para validar que la tienda esté abierta — antes el client
  // ocultaba el botón "Agregar" fuera de horario, pero un cliente con dev
  // tools podía submitear igual y el carrito aceptaba el ítem.
  const now = new Date();
  const product = await db.product.findFirst({
    where: { id: data.productId, storeId: store.id, isActive: true },
    include: {
      variants: data.variantId ? { where: { id: data.variantId } } : false,
    },
  });
  if (!product) throw new Error("Producto no disponible");

  // Schedule del producto (combos del almuerzo, especiales del finde).
  // El SRS dice que un producto fuera de horario aparece atenuado en el
  // storefront, pero el cliente NO debe poder agregarlo al carrito.
  if (!isProductAvailableNow(product, now)) {
    throw new Error(
      "Este producto no está disponible en este horario. Vuelve en su horario de venta.",
    );
  }

  // Nota: NO validamos `isStoreOpenNow` acá. El cliente puede armar el
  // carrito fuera de horario y elegir programar entrega/recojo en el
  // checkout — la validación de horario está en `createOrderAction`.

  let unitPrice = Number(product.basePrice);
  let variantId: string | null = null;

  if (data.variantId) {
    const variant = product.variants?.[0];
    if (!variant || variant.productId !== product.id || !variant.isActive) {
      throw new Error("Variante no disponible");
    }
    if (variant.price != null) unitPrice = Number(variant.price);
    variantId = variant.id;
  }

  const { cart } = await getOrCreateCart(store.id, store.slug);

  // Update-or-create manual: el `@@unique([cartId, productId, variantId])`
  // del schema no actúa cuando `variantId` es NULL (Postgres trata cada
  // NULL como distinto, salvo NULLS NOT DISTINCT que requiere Pg 15+ y
  // reescribir la migración). El `upsert` de Prisma necesita un `where`
  // exacto y pasaba `variantId: ""` que NUNCA matcheaba contra una fila
  // con `variantId: NULL` — resultado: cada "agregar al carrito" creaba
  // una fila nueva para productos sin variante. Bug silencioso: carrito
  // duplicado, total inflado al checkout.
  //
  // updateMany atómico primero (idempotente). Solo crea si no había
  // ninguna fila. Ventana de race teórica con dos requests del MISMO
  // usuario al mismo instante creando duplicados — extremadamente raro
  // porque el cliente espera respuesta antes del próximo click.
  //
  // `unitPrice` se refresca al precio actual: si el owner sube el precio
  // del producto mientras el cliente lo tiene en el carrito, el snapshot
  // muestra el nuevo precio (y el checkout cobra ese mismo número, que
  // se recalcula server-side igualmente). Sin esto, la UI mostraba el
  // precio viejo guardado al insertar y el cobro final no coincidía —
  // fuente directa de chargebacks.
  // Transacción atómica: updateMany + create + refresh expiresAt.
  //
  // Race que se cierra acá:
  //   1. Doble-tap en mobile (mismo cliente, dos requests simultáneas).
  //      Ambas hacen updateMany → ambas obtienen count=0 → ambas hacen
  //      create → la segunda fallaba con P2002 (unique [cartId, productId,
  //      variantId]) no manejado.
  //   2. Cron de cleanup borra el Cart entre el `getOrCreateCart` y el
  //      cartItem.create → FK violation P2003 no manejada. El refresh
  //      del expiresAt aquí dentro de la tx protege contra el cron del
  //      cleanup, que solo borra `expiresAt < now`.
  //
  // El P2002 se atrapa como "ya existe", se reintenta el updateMany dentro
  // de la misma transacción.
  try {
    await db.$transaction(async (tx) => {
      // Renovar `expiresAt` PRIMERO — si el cleanup cron está corriendo,
      // movemos la línea de borrado lejos antes de tocar items.
      await tx.cart.update({
        where: { id: cart.id },
        data: { expiresAt: new Date(Date.now() + CART_TTL_MS) },
      });
      const updated = await tx.cartItem.updateMany({
        where: {
          cartId: cart.id,
          productId: product.id,
          variantId: variantId ?? null,
        },
        data: {
          quantity: { increment: data.quantity },
          notes: data.notes ?? undefined,
          unitPrice,
        },
      });
      if (updated.count === 0) {
        try {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: product.id,
              variantId,
              quantity: data.quantity,
              notes: data.notes ?? null,
              unitPrice,
            },
          });
        } catch (err) {
          // Si una request hermana creó el item entre el updateMany y el
          // create (P2002 en unique), reintentamos el updateMany — ahora
          // sí existe y suma la quantity.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            await tx.cartItem.updateMany({
              where: {
                cartId: cart.id,
                productId: product.id,
                variantId: variantId ?? null,
              },
              data: {
                quantity: { increment: data.quantity },
                notes: data.notes ?? undefined,
                unitPrice,
              },
            });
          } else {
            throw err;
          }
        }
      }
    });
  } catch (err) {
    // P2003: el Cart fue borrado por el cron de cleanup entre
    // `getOrCreateCart` y la transacción. Mensaje claro al cliente.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2003"
    ) {
      return { error: "Tu carrito expiró. Recarga la página e intenta de nuevo." };
    }
    throw err;
  }

  revalidatePath(`/${store.slug}`);
  return getCartSnapshot(store.slug);
}

const updateQtySchema = z.object({
  storeSlug: z.string().min(1),
  cartItemId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
});

export async function updateCartItemQuantity(input: z.input<typeof updateQtySchema>) {
  const data = updateQtySchema.parse(input);

  const store = await getStoreBySlug(data.storeSlug);
  if (!store) throw new Error("Tienda no encontrada");

  const item = await db.cartItem.findUnique({
    where: { id: data.cartItemId },
    include: { cart: true },
  });
  if (!item || item.cart.storeId !== store.id) {
    throw new Error("Item no encontrado");
  }

  // Validar guest token coincide
  const token = await readGuestToken();
  if (item.cart.guestToken !== token) throw new Error("No autorizado");

  if (data.quantity === 0) {
    await db.cartItem.delete({ where: { id: item.id } });
  } else {
    await db.cartItem.update({
      where: { id: item.id },
      data: { quantity: data.quantity },
    });
  }

  revalidatePath(`/${store.slug}`);
  return getCartSnapshot(store.slug);
}

export async function removeCartItem(input: { storeSlug: string; cartItemId: string }) {
  return updateCartItemQuantity({
    storeSlug: input.storeSlug,
    cartItemId: input.cartItemId,
    quantity: 0,
  });
}

export async function getCartSnapshot(storeSlug: string): Promise<CartSnapshot | null> {
  const store = await getStoreBySlug(storeSlug);
  if (!store) return null;

  const token = await readGuestToken();
  if (!token) return null;

  const cart = await db.cart.findFirst({
    where: { storeId: store.id, guestToken: token, expiresAt: { gt: new Date() } },
    include: cartIncludeShape,
  });

  if (!cart) return null;

  return buildSnapshot(cart, store.slug);
}

export async function clearCart(storeSlug: string) {
  const store = await getStoreBySlug(storeSlug);
  if (!store) throw new Error("Tienda no encontrada");

  const token = await readGuestToken();
  if (!token) return null;

  const cart = await db.cart.findFirst({
    where: { storeId: store.id, guestToken: token },
  });
  if (!cart) return null;

  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  revalidatePath(`/${store.slug}`);
  return null;
}
