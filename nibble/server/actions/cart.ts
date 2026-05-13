"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureGuestToken, readGuestToken } from "@/lib/cart/cookies";
import { getStoreBySlug } from "@/lib/tenant/resolve";
import {
  isProductAvailableNow,
  isStoreOpenNow,
} from "@/lib/storefront/availability";
import type { Cart, CartItem, ProductVariant } from "@prisma/client";

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

export type CartSnapshot = {
  cartId: string;
  storeId: string;
  storeSlug: string;
  items: CartLine[];
  subtotal: number;
  itemCount: number;
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
      variant: { select: { id: true, name: true, price: true } },
    },
  },
} as const;

type CartWithItems = Cart & {
  items: (CartItem & {
    variant: Pick<ProductVariant, "id" | "name" | "price"> | null;
  })[];
};

async function buildSnapshot(
  cart: CartWithItems,
  storeSlug: string,
): Promise<CartSnapshot> {
  // Fetch product info para todos los items en una sola query.
  // Filtramos por storeId para aislamiento multi-tenant: si por cualquier
  // inconsistencia un CartItem apunta a un productId de OTRA tienda, no
  // queremos materializar ese producto en el snapshot ni cobrarlo.
  const productIds = Array.from(new Set(cart.items.map((i) => i.productId)));
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, storeId: cart.storeId },
        select: { id: true, name: true, slug: true, basePrice: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  // Productos eliminados o de otra tienda → la línea se omite del snapshot.
  // El CartItem queda huérfano en DB pero no se cobra ni se muestra al cliente.
  const lines: CartLine[] = [];
  for (const item of cart.items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const unitPrice = Number(item.unitPrice);
    const variant = item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name,
          price: item.variant.price !== null ? Number(item.variant.price) : null,
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
        basePrice: Number(product.basePrice),
      },
      variant,
      lineTotal,
    });
  }

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    cartId: cart.id,
    storeId: cart.storeId,
    storeSlug,
    items: lines,
    subtotal,
    itemCount,
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
  const [product, storeHours] = await Promise.all([
    db.product.findFirst({
      where: { id: data.productId, storeId: store.id, isActive: true },
      include: {
        variants: data.variantId ? { where: { id: data.variantId } } : false,
      },
    }),
    db.storeHours.findMany({ where: { storeId: store.id } }),
  ]);
  if (!product) throw new Error("Producto no disponible");

  // Schedule del producto (combos del almuerzo, especiales del finde).
  // El SRS dice que un producto fuera de horario aparece atenuado en el
  // storefront, pero el cliente NO debe poder agregarlo al carrito.
  if (!isProductAvailableNow(product, now)) {
    throw new Error(
      "Este producto no está disponible en este horario. Volvé en su horario de venta.",
    );
  }

  // Tienda cerrada: bloqueamos el "agregar al carrito" para evitar pedidos
  // a las 4am que el local recibe a la mañana siguiente con productos
  // perecederos ya descompuestos.
  if (!isStoreOpenNow(storeHours, now)) {
    throw new Error(
      "La tienda está cerrada ahora. Probá agregar al carrito durante el horario de atención.",
    );
  }

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
  const updated = await db.cartItem.updateMany({
    where: {
      cartId: cart.id,
      productId: product.id,
      variantId: variantId ?? null,
    },
    data: {
      quantity: { increment: data.quantity },
      notes: data.notes ?? undefined,
    },
  });
  if (updated.count === 0) {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        variantId,
        quantity: data.quantity,
        notes: data.notes ?? null,
        unitPrice,
      },
    });
  }

  // Refresh expiración
  await db.cart.update({
    where: { id: cart.id },
    data: { expiresAt: new Date(Date.now() + CART_TTL_MS) },
  });

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
