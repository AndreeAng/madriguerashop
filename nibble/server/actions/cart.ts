"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureGuestToken, readGuestToken } from "@/lib/cart/cookies";
import { getStoreBySlug } from "@/lib/tenant/resolve";
import type { Cart, CartItem, Product, ProductVariant } from "@prisma/client";

// ============== Types ==============

export type CartLine = CartItem & {
  product: Pick<Product, "id" | "name" | "slug" | "basePrice">;
  variant: Pick<ProductVariant, "id" | "name" | "price"> | null;
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

const CART_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

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
  // Fetch product info para todos los items en una sola query
  const productIds = Array.from(new Set(cart.items.map((i) => i.productId)));
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true, basePrice: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const lines: CartLine[] = cart.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      // Producto eliminado — devolvemos placeholder y subtotal=0 para esa línea
      return {
        ...item,
        product: { id: item.productId, name: "(producto eliminado)", slug: "", basePrice: item.unitPrice },
        variant: item.variant,
        lineTotal: 0,
      };
    }
    const lineTotal = Number(item.unitPrice) * item.quantity;
    subtotal += lineTotal;
    return {
      ...item,
      product,
      variant: item.variant,
      lineTotal,
    };
  });

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

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

  // Validar producto y precio (no confiamos del cliente)
  const product = await db.product.findFirst({
    where: { id: data.productId, storeId: store.id, isActive: true },
    include: { variants: data.variantId ? { where: { id: data.variantId } } : false },
  });
  if (!product) throw new Error("Producto no disponible");

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

  // Si ya existe este productId+variantId en el carrito, incrementamos cantidad
  await db.cartItem.upsert({
    where: {
      cartId_productId_variantId: {
        cartId: cart.id,
        productId: product.id,
        variantId: variantId ?? "",
      },
    },
    create: {
      cartId: cart.id,
      productId: product.id,
      variantId,
      quantity: data.quantity,
      notes: data.notes ?? null,
      unitPrice,
    },
    update: {
      quantity: { increment: data.quantity },
      notes: data.notes ?? undefined,
    },
  });

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

const removeSchema = z.object({
  storeSlug: z.string().min(1),
  cartItemId: z.string().min(1),
});

export async function removeCartItem(input: z.input<typeof removeSchema>) {
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
