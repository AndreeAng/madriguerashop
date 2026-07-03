/**
 * View models del storefront público.
 *
 * Estos tipos son lo que consumen los componentes de UI. El adapter
 * (lib/storefront/adapter.ts) los construye desde Prisma.
 *
 * Filosofía: si un campo no existe en DB todavía (rating, reseñas, etc),
 * lo declaramos opcional y la UI lo oculta cuando falta.
 */

import type { StoreVertical } from "@prisma/client";

export type StoreView = {
  slug: string;
  name: string;
  description: string;
  tagline: string;
  city: string;
  // Vertical de la tienda. Define el copy del storefront (placeholders,
  // labels de variantes, frases promocionales). Ver lib/storefront/copy.ts.
  vertical: StoreVertical;
  /** WhatsApp del comerciante. Puede ser `null` si la tienda no lo configuró
   *  todavía — los componentes que lo renderizan deben null-guard antes de
   *  formatear o crear el link `wa.me/...`. */
  whatsapp: string | null;
  email: string | null;
  addressText: string | null;

  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  logoUrl: string | null;
  logoEmoji: string; // fallback del logo cuando no hay logoUrl (2 letras del nombre)
  bannerImage: string;

  /** Hora de cierre de hoy en formato "HH:MM", o null si HOY está marcado
   *  como cerrado (`isClosed`). NO indica si el local está abierto ahora —
   *  para eso usar `isOpenNow`. */
  closesTodayAt: string | null;
  /** True si la tienda está abierta AHORA, evaluado en hora BOLIVIA
   *  explícita (`isStoreOpenNow` + `inBolivia`) — independiente de la TZ
   *  del proceso. Considera día de la semana, rango open/close del día y
   *  horarios nocturnos que cruzan medianoche. */
  isOpenNow: boolean;
  /** Texto humano "Abre mañana a las 10:00", "Abre el lunes 10:00", etc.
   *  Solo presente si `isOpenNow=false`. Null si la tienda no tiene
   *  horarios futuros configurados (todos los días cerrados). */
  nextOpeningLabel: string | null;
  /** "Lun – Dom · 11:00 – 23:00" formateado para el footer. Derivado de
   * `hoursGroups.map(g => "días · horario").join(" · ")` — mantener para
   * componentes que sólo quieren una línea. */
  hoursSummary: string;
  /**
   * Horarios estructurados: cada item es un grupo de días con el mismo
   * `openTime`/`closeTime`, ya consolidado en rangos consecutivos.
   * Ej. La Latita (Mar–Dom 18:00–23:30): `[{ days: "Mar – Dom", time: "18:00 – 23:30" }]`.
   * Pensado para renderizar como lista vertical en el storefront card.
   */
  hoursGroups: Array<{ days: string; time: string }>;

  // Métricas (opcionales — pueden no estar disponibles)
  ordersThisMonth?: number;
  rating?: number;

  // Redes (todas opcionales)
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;

  // Pagos
  acceptsQR: boolean;
  acceptsCashOnDelivery: boolean;
};

export type ProductView = {
  id: string;
  slug: string;
  storeSlug: string;
  name: string;
  description: string;
  category: string;
  /** ID interno de la categoría — útil para builds del cliente. Vacío si el producto no tiene cat. */
  categoryId: string | null;
  price: number;
  comparePrice?: number;
  image: string;
  badge?: "new" | "best" | "promo";
  badgeLabel?: string;
  rating?: number;
  /** Si el producto en su totalidad puede agregarse al carrito. False si:
   *  - El producto está inactivo, o
   *  - El producto maneja stock global y stock=0, o
   *  - Tiene variantes y TODAS están agotadas. */
  available: boolean;
  /** Servicio reservable: la UI muestra "Reservar" + redirige a la PDP
   *  para elegir día/hora, en lugar del flujo carrito-checkout. */
  isBookable: boolean;
  /** Variantes que el usuario puede seleccionar. Cada una expone su propia
   *  disponibilidad para que la UI desactive los selects agotados (ej.
   *  "Clavo 9mm" disponible, "Clavo 11mm" agotado). */
  variants?: {
    id: string;
    name: string;
    priceDelta: number;
    /** False si maneja stock y stock=0, o si la variante está inactiva. */
    available: boolean;
  }[];
};
