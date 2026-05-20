import type { StoreVertical } from "@prisma/client";

/**
 * Copy del storefront por vertical. Antes estos strings vivían hardcodeados
 * en `StorefrontMenu`/`StorefrontHeader`/`ProductQuickView`/`CheckoutForm`
 * con texto de restaurante ("wings", "platos", "30-45 min"), lo que dejaba
 * a tiendas de hardware/retail/servicios con copy incoherente.
 *
 * Fuente única: este módulo. Agregar una vertical nueva implica agregar
 * una entrada acá y nada más.
 */
export type StorefrontCopy = {
  /** Placeholder del input de búsqueda en el header. */
  searchPlaceholder: string;
  /** Placeholder del campo "instrucciones" del checkout. */
  checkoutNotesPlaceholder: string;
  /** Título y subtítulo de la sección de destacados en la home. */
  featuredTitle: string;
  featuredSubtitle: string;
  /** Pill que aparece sobre los destacados ("Lo más pedido hoy" en restaurante). */
  featuredPill: string;
  /** Label del selector de variantes (Tamaño/Talla/Modelo/etc). */
  variantLabel: string;
  /** Frase de tiempo de entrega en la quick view de producto. */
  deliveryHint: string;
  /** Label del campo "notas" a nivel ítem (PDP + QuickView). En restaurante
   * son "Notas para la cocina", en hardware "Especificaciones", etc. */
  productNotesLabel: string;
  /** Placeholder del mismo campo. */
  productNotesPlaceholder: string;
  /** aria-label del botón hamburguesa del header mobile. Restaurante "Menú",
   * retail "Catálogo", servicios "Servicios", panadería "Carta". */
  menuAriaLabel: string;
  /** Texto visible del botón de carrito en el header.
   * Restaurante/comida: "Tu pedido" o "Carrito". Retail: "Carrito".
   * Servicios: "Tu solicitud". */
  cartLabel: string;
  /** Singular y plural del sustantivo de ítem ("producto"/"plato"/
   * "servicio"/"artículo"). Se usa en aria-labels dinámicos y placeholders. */
  itemSingular: string;
  itemPlural: string;
  /** Singular y plural del sustantivo de pedido ("pedido"/"orden"/
   * "solicitud"/"reserva"). Se usa en headings de páginas como
   * /sobre-nosotros y mensajes de tracking del cliente. */
  orderSingular: string;
  orderPlural: string;
};

const RESTAURANT_LIKE: StorefrontCopy = {
  searchPlaceholder: "Buscar platos, combos, bebidas…",
  checkoutNotesPlaceholder: "Sin picante, sin cebolla, etc.",
  featuredTitle: "Las imperdibles de la casa",
  featuredSubtitle: "Lo que nuestros clientes piden semana tras semana.",
  featuredPill: "Lo más pedido hoy",
  variantLabel: "Tamaño",
  deliveryHint: "Entrega 30–45 min",
  productNotesLabel: "Notas para la cocina",
  productNotesPlaceholder: "Sin cebolla, término medio, etc.",
  menuAriaLabel: "Menú",
  cartLabel: "Tu pedido",
  itemSingular: "plato",
  itemPlural: "platos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const RETAIL_LIKE: StorefrontCopy = {
  searchPlaceholder: "Buscar productos…",
  checkoutNotesPlaceholder: "Color, talla, instrucciones especiales…",
  featuredTitle: "Recomendados",
  featuredSubtitle: "Lo que más se lleva la gente esta semana.",
  featuredPill: "Top ventas",
  variantLabel: "Variante",
  deliveryHint: "Entrega en el día",
  productNotesLabel: "Notas para el pedido",
  productNotesPlaceholder: "Color, talla, preferencias…",
  menuAriaLabel: "Catálogo",
  cartLabel: "Carrito",
  itemSingular: "producto",
  itemPlural: "productos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const HARDWARE: StorefrontCopy = {
  searchPlaceholder: "Buscar herramientas, materiales…",
  checkoutNotesPlaceholder: "Marca preferida, modelo, etc.",
  featuredTitle: "Los más vendidos",
  featuredSubtitle: "Las herramientas y materiales que siempre se piden.",
  featuredPill: "Top de la semana",
  variantLabel: "Modelo",
  deliveryHint: "Entrega a domicilio",
  productNotesLabel: "Especificaciones",
  productNotesPlaceholder: "Marca preferida, calibre, longitud…",
  menuAriaLabel: "Catálogo",
  cartLabel: "Carrito",
  itemSingular: "artículo",
  itemPlural: "artículos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const SERVICES: StorefrontCopy = {
  searchPlaceholder: "Buscar servicios…",
  checkoutNotesPlaceholder: "Detalles adicionales, dirección de referencia…",
  featuredTitle: "Servicios destacados",
  featuredSubtitle: "Lo que más nos piden esta temporada.",
  featuredPill: "Más solicitados",
  variantLabel: "Plan",
  deliveryHint: "Coordinamos por WhatsApp",
  productNotesLabel: "Detalles del servicio",
  productNotesPlaceholder: "Horario preferido, dirección, otros detalles…",
  menuAriaLabel: "Servicios",
  cartLabel: "Tu solicitud",
  itemSingular: "servicio",
  itemPlural: "servicios",
  orderSingular: "solicitud",
  orderPlural: "solicitudes",
};

const BAKERY: StorefrontCopy = {
  searchPlaceholder: "Buscar panes, tortas, postres…",
  checkoutNotesPlaceholder: "Sin azúcar, mensaje en la torta, etc.",
  featuredTitle: "Las consentidas de la casa",
  featuredSubtitle: "Recién horneadas — preparadas el día que las pedís.",
  featuredPill: "Más pedidos hoy",
  variantLabel: "Tamaño",
  deliveryHint: "Entrega en el día",
  productNotesLabel: "Notas para la pastelería",
  productNotesPlaceholder: "Mensaje en la torta, sin azúcar, alergias…",
  menuAriaLabel: "Carta",
  cartLabel: "Tu pedido",
  itemSingular: "producto",
  itemPlural: "productos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const GROCERY: StorefrontCopy = {
  searchPlaceholder: "Buscar productos, marcas…",
  checkoutNotesPlaceholder: "Marca preferida, sustitutos permitidos, etc.",
  featuredTitle: "Lo que más se lleva la gente",
  featuredSubtitle: "Esenciales de la semana y ofertas activas.",
  featuredPill: "Top de la semana",
  variantLabel: "Presentación",
  deliveryHint: "Entrega a domicilio",
  productNotesLabel: "Notas para el pedido",
  productNotesPlaceholder: "Marca preferida, sustitutos permitidos…",
  menuAriaLabel: "Catálogo",
  cartLabel: "Carrito",
  itemSingular: "producto",
  itemPlural: "productos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const BEAUTY: StorefrontCopy = {
  searchPlaceholder: "Buscar productos, servicios de belleza…",
  checkoutNotesPlaceholder: "Tono, tipo de piel, alergias…",
  featuredTitle: "Bestsellers",
  featuredSubtitle: "Los favoritos de nuestras clientas.",
  featuredPill: "Más vendidos",
  variantLabel: "Tono / Presentación",
  deliveryHint: "Entrega en el día",
  productNotesLabel: "Notas",
  productNotesPlaceholder: "Tipo de piel, alergias, preferencias…",
  menuAriaLabel: "Catálogo",
  cartLabel: "Carrito",
  itemSingular: "producto",
  itemPlural: "productos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const HEALTH: StorefrontCopy = {
  searchPlaceholder: "Buscar medicamentos, productos…",
  checkoutNotesPlaceholder: "Receta médica, dosis, otros detalles…",
  featuredTitle: "Más solicitados",
  featuredSubtitle: "Productos de uso frecuente y consultas habituales.",
  featuredPill: "Más vendidos",
  variantLabel: "Presentación",
  deliveryHint: "Entrega a domicilio",
  productNotesLabel: "Notas",
  productNotesPlaceholder: "Receta, dosis, marca específica…",
  menuAriaLabel: "Catálogo",
  cartLabel: "Carrito",
  itemSingular: "producto",
  itemPlural: "productos",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const OTHER: StorefrontCopy = {
  searchPlaceholder: "Buscar productos o servicios…",
  checkoutNotesPlaceholder: "Detalles adicionales o instrucciones especiales…",
  featuredTitle: "Destacados",
  featuredSubtitle: "Lo que más nos piden esta temporada.",
  featuredPill: "Top",
  variantLabel: "Opción",
  deliveryHint: "Coordinamos por WhatsApp",
  productNotesLabel: "Notas",
  productNotesPlaceholder: "Detalles adicionales o instrucciones…",
  menuAriaLabel: "Menú",
  cartLabel: "Carrito",
  itemSingular: "ítem",
  itemPlural: "ítems",
  orderSingular: "pedido",
  orderPlural: "pedidos",
};

const COPY_BY_VERTICAL: Record<StoreVertical, StorefrontCopy> = {
  RESTAURANT: RESTAURANT_LIKE,
  FOOD_TRUCK: RESTAURANT_LIKE,
  BAKERY: BAKERY,
  GROCERY: GROCERY,
  RETAIL: RETAIL_LIKE,
  HARDWARE: HARDWARE,
  BEAUTY: BEAUTY,
  HEALTH: HEALTH,
  SERVICES: SERVICES,
  OTHER: OTHER,
};

export function storefrontCopy(vertical: StoreVertical): StorefrontCopy {
  return COPY_BY_VERTICAL[vertical] ?? RETAIL_LIKE;
}
