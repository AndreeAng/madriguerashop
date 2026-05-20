import type { StoreVertical } from "@prisma/client";

/**
 * Copy del dashboard del owner por vertical. Hermano de `lib/storefront/copy.ts`
 * pero del lado backoffice: títulos del sidebar, headings de páginas,
 * mensajes de empty-state.
 *
 * El owner de una ferretería ve "Catálogo" y "Artículos" en lugar de
 * "Productos"; el de una peluquería ve "Servicios" y "Solicitudes" en
 * lugar de "Pedidos". Sin esto las plantillas se sienten alquiladas en
 * lugar de hechas para su rubro.
 *
 * Fuente única — agregar una vertical implica una entrada acá y nada más.
 */
export type DashboardCopy = {
  /** Label del item del sidebar y h1 de la página /dashboard/productos. */
  productsLabel: string;
  /** Singular ("producto"/"plato"/"servicio") usado en empty-states
   * y en CTAs ("Crear producto" / "Crear plato"). */
  productSingular: string;
  /** Label del sidebar y h1 de /dashboard/pedidos. Restaurante: "Pedidos".
   * Servicios: "Solicitudes". */
  ordersLabel: string;
  /** Singular del pedido para empty-states + filtros. */
  orderSingular: string;
};

const DEFAULT: DashboardCopy = {
  productsLabel: "Productos",
  productSingular: "producto",
  ordersLabel: "Pedidos",
  orderSingular: "pedido",
};

const RESTAURANT_LIKE: DashboardCopy = {
  productsLabel: "Platos",
  productSingular: "plato",
  ordersLabel: "Pedidos",
  orderSingular: "pedido",
};

const SERVICES: DashboardCopy = {
  productsLabel: "Servicios",
  productSingular: "servicio",
  ordersLabel: "Solicitudes",
  orderSingular: "solicitud",
};

const HARDWARE: DashboardCopy = {
  productsLabel: "Artículos",
  productSingular: "artículo",
  ordersLabel: "Pedidos",
  orderSingular: "pedido",
};

const BAKERY: DashboardCopy = {
  // Carta para clientes / Productos para owner — "Productos" en el dashboard
  // es más operativo (lo que stockean, no lo que muestran). Sin sobreescritura
  // al default.
  ...DEFAULT,
};

const COPY_BY_VERTICAL: Record<StoreVertical, DashboardCopy> = {
  RESTAURANT: RESTAURANT_LIKE,
  FOOD_TRUCK: RESTAURANT_LIKE,
  BAKERY: BAKERY,
  GROCERY: DEFAULT,
  RETAIL: DEFAULT,
  HARDWARE: HARDWARE,
  BEAUTY: DEFAULT,
  HEALTH: DEFAULT,
  SERVICES: SERVICES,
  OTHER: DEFAULT,
};

export function dashboardCopy(vertical: StoreVertical): DashboardCopy {
  return COPY_BY_VERTICAL[vertical] ?? DEFAULT;
}
