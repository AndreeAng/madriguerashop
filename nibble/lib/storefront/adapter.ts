import "server-only";
import type {
  Store,
  StoreHours,
  Product,
  ProductImage,
  ProductVariant,
  Category,
} from "@prisma/client";
import type { StoreView, ProductView } from "./types";
import { isProductAvailableNow } from "./availability";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=1600&q=80";
const FALLBACK_PRODUCT =
  "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=900&q=80";

// Nombres en orden Prisma (0=Dom ... 6=Sáb) para `closesTodayAt` que usa
// `Date.getDay()`. La lista de horarios en cambio se renderiza en orden
// europeo (Lun primero, Dom último) — más natural para leer.
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Orden europeo: 1=Lun, 2=Mar, ..., 6=Sáb, 7=Dom. Para detectar runs
// consecutivos sin que Dom y Lun "se peguen" (no lo hacen en este orden).
function europeanIdx(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

/** Letras iniciales del nombre — fallback de logo. */
function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "·";
}

/**
 * Agrupa los horarios en bloques fáciles de leer.
 *
 * Estrategia:
 *   1. Filtramos días abiertos y los ordenamos en orden europeo (Lun→Dom).
 *   2. Agrupamos por (openTime, closeTime). Todos los días del mismo grupo
 *      comparten exactamente el mismo horario.
 *   3. Dentro de cada grupo, detectamos runs consecutivos y los expresamos
 *      como "Mar – Sáb"; los huecos quedan como entradas separadas con coma:
 *      "Lun, Mié – Vie".
 *
 * Ejemplos:
 *   Lun–Dom 11:00–23:00         → ["Lun – Dom · 11:00 – 23:00"]
 *   Mar–Dom 18:00–23:30, Lun ✕  → ["Mar – Dom · 18:00 – 23:30"]
 *   Lun–Vie 9–21, Sáb 10–18     → ["Lun – Vie · 09:00 – 21:00",
 *                                  "Sáb · 10:00 – 18:00"]
 *   Lun, Mié, Vie 9–21          → ["Lun, Mié, Vie · 09:00 – 21:00"]
 */
function groupHours(hours: StoreHours[]): Array<{ days: string; time: string }> {
  const open = hours
    .filter((h) => !h.isClosed)
    .sort((a, b) => europeanIdx(a.dayOfWeek) - europeanIdx(b.dayOfWeek));

  if (open.length === 0) return [];

  // 1. Agrupar por horario, preservando el orden europeo de aparición.
  const byTime = new Map<string, number[]>(); // key = "open|close", value = dayOfWeek[]
  for (const h of open) {
    const key = `${h.openTime}|${h.closeTime}`;
    const arr = byTime.get(key);
    if (arr) arr.push(h.dayOfWeek);
    else byTime.set(key, [h.dayOfWeek]);
  }

  // 2. Construir un string de días por grupo, colapsando runs consecutivos.
  const result: Array<{ days: string; time: string }> = [];
  for (const [key, days] of byTime) {
    const [openTime, closeTime] = key.split("|") as [string, string];
    days.sort((a, b) => europeanIdx(a) - europeanIdx(b));

    const runs: Array<[number, number]> = []; // pairs of [start, end] dayOfWeek
    for (const d of days) {
      const last = runs[runs.length - 1];
      if (last && europeanIdx(d) === europeanIdx(last[1]) + 1) {
        last[1] = d; // extender el run actual
      } else {
        runs.push([d, d]);
      }
    }

    const daysLabel = runs
      .map(([from, to]) =>
        from === to
          ? DAY_NAMES[from]
          : `${DAY_NAMES[from]} – ${DAY_NAMES[to]}`,
      )
      .join(", ");
    result.push({ days: daysLabel, time: `${openTime} – ${closeTime}` });
  }

  return result;
}

/** Devuelve la versión en una línea — usada por el footer y meta tags. */
function summarizeHours(groups: Array<{ days: string; time: string }>): string {
  if (groups.length === 0) return "Cerrado";
  return groups.map((g) => `${g.days} · ${g.time}`).join(" · ");
}

/** Hora de cierre de HOY si está abierta, o null. */
function closesTodayAt(hours: StoreHours[], now = new Date()): string | null {
  const today = hours.find((h) => h.dayOfWeek === now.getDay());
  if (!today || today.isClosed) return null;
  return today.closeTime;
}

// ============== Store ==============

export function toStoreView(
  store: Store,
  opts: {
    hours: StoreHours[];
    ordersThisMonth?: number;
    now?: Date;
  },
): StoreView {
  const tagline = store.description ?? store.name;

  return {
    slug: store.slug,
    name: store.name,
    description: store.description ?? `${store.name} · ${store.city ?? ""}`.trim(),
    tagline,
    city: store.city ?? "Bolivia",
    vertical: store.vertical,
    whatsapp: store.whatsappPhone,
    email: store.email,
    addressText: store.addressText,

    primaryColor: store.primaryColor,
    secondaryColor: store.secondaryColor,
    accentColor: store.accentColor,

    logoUrl: store.logoUrl,
    logoEmoji: initials(store.name),
    bannerImage: store.bannerUrl ?? FALLBACK_BANNER,

    closesTodayAt: closesTodayAt(opts.hours, opts.now),
    hoursGroups: groupHours(opts.hours),
    hoursSummary: summarizeHours(groupHours(opts.hours)),

    ordersThisMonth: opts.ordersThisMonth,
    // rating: no implementado — el campo en `StoreView` es opcional para que
    // la UI lo oculte. Cuando se agregue al schema, asignar acá.

    instagram: store.instagram,
    facebook: store.facebook,
    tiktok: store.tiktok,
    website: store.website,

    acceptsQR: store.acceptsQR,
    acceptsCashOnDelivery: store.acceptsCashOnDelivery,
  };
}

// ============== Product ==============

type ProductWithRelations = Product & {
  images: ProductImage[];
  variants: ProductVariant[];
  category: Pick<Category, "id" | "name"> | null;
};

/**
 * Determina el badge a mostrar. Prioridad:
 *  1. customLabel (definido por el owner) → "promo"
 *  2. isBestSeller → "best"
 *  3. isNew → "new"
 *  4. comparePrice > basePrice → "promo" implícito de descuento
 */
function pickBadge(
  product: Product,
): { badge: ProductView["badge"]; badgeLabel: string } | undefined {
  if (product.customLabel) {
    return { badge: "promo", badgeLabel: product.customLabel };
  }
  if (product.isBestSeller) {
    return { badge: "best", badgeLabel: "Más vendido" };
  }
  if (product.isNew) {
    return { badge: "new", badgeLabel: "Nuevo" };
  }
  return undefined;
}

// `isWithinSchedule` ahora vive en `lib/storefront/availability.ts` como
// `isProductAvailableNow` para que server actions (cart, orders) puedan
// reutilizar la misma regla sin importar este adapter (que arrastra todo
// el shape del storefront).

export function toProductView(
  product: ProductWithRelations,
  storeSlug: string,
  now: Date = new Date(),
): ProductView {
  const basePrice = Number(product.basePrice);
  const comparePrice = product.comparePrice ? Number(product.comparePrice) : undefined;

  const badgeInfo = pickBadge(product);

  const image = product.images[0]?.url ?? FALLBACK_PRODUCT;

  // Variantes: priceDelta = (variant.price ?? basePrice) - basePrice.
  // `available` por variante: respeta `manageStock` propio de la variante,
  // así un clavo 9mm con stock puede comprarse aunque el 11mm esté agotado.
  const variants = product.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => ({
      id: v.id,
      name: v.name,
      priceDelta: (v.price ? Number(v.price) : basePrice) - basePrice,
      available: !v.manageStock || v.stock > 0,
    }));

  // Disponibilidad del producto a nivel general:
  //   - Sin variantes: usa el stock global del producto.
  //   - Con variantes: disponible si AL MENOS UNA variante está disponible
  //     (la UI le deja al usuario elegir cuál). Si todas están agotadas, el
  //     producto entero queda no disponible.
  const productAvailable = product.isActive && isProductAvailableNow(product, now);
  let available: boolean;
  if (variants.length === 0) {
    available = productAvailable && (!product.manageStock || product.stock > 0);
  } else {
    available = productAvailable && variants.some((v) => v.available);
  }

  return {
    id: product.id,
    slug: product.slug,
    storeSlug,
    name: product.name,
    description: product.description ?? product.shortDescription ?? "",
    category: product.category?.name ?? "Otros",
    categoryId: product.category?.id ?? null,
    price: basePrice,
    comparePrice,
    image,
    isBookable: product.isBookable,
    badge: badgeInfo?.badge,
    badgeLabel: badgeInfo?.badgeLabel,
    available,
    variants: variants.length > 0 ? variants : undefined,
  };
}
