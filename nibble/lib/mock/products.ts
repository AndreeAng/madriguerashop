export type MockProduct = {
  slug: string;
  storeSlug: string;
  name: string;
  category: string;
  price: number;
  comparePrice?: number;
  description: string;
  image: string;
  badge?: "new" | "best" | "promo";
  badgeLabel?: string;
  rating?: number;
  available: boolean;
  variants?: { name: string; priceDelta: number }[];
};

export const products: MockProduct[] = [
  {
    slug: "wings-clasicos",
    storeSlug: "big-bite-wings",
    name: "Wings Clásicos BBQ",
    category: "Wings",
    price: 45,
    comparePrice: 55,
    description:
      "12 alitas marinadas 24h, glaseadas con nuestra salsa BBQ ahumada. Servidas con apio fresco y dip de queso azul.",
    image:
      "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=900&q=80",
    badge: "best",
    badgeLabel: "Más vendido",
    rating: 4.9,
    available: true,
    variants: [
      { name: "6 piezas", priceDelta: -20 },
      { name: "12 piezas", priceDelta: 0 },
      { name: "24 piezas", priceDelta: 35 },
    ],
  },
  {
    slug: "wings-buffalo",
    storeSlug: "big-bite-wings",
    name: "Buffalo Hot",
    category: "Wings",
    price: 48,
    description:
      "Las que prendieron NYC. Picante medio-alto, con un toque de mantequilla y vinagre. Solo para los valientes.",
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=900&q=80",
    badge: "promo",
    badgeLabel: "Solo hoy",
    rating: 4.7,
    available: true,
  },
  {
    slug: "wings-honey",
    storeSlug: "big-bite-wings",
    name: "Honey Mustard",
    category: "Wings",
    price: 46,
    description: "Miel artesanal + mostaza Dijon. Dulce con carácter.",
    image:
      "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=900&q=80",
    badge: "new",
    badgeLabel: "Nuevo",
    available: true,
  },
  {
    slug: "papas-cheese",
    storeSlug: "big-bite-wings",
    name: "Cheese Fries",
    category: "Entradas",
    price: 32,
    description: "Papas crujientes, queso cheddar derretido, tocino y cebollín.",
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=900&q=80",
    rating: 4.8,
    available: true,
  },
  {
    slug: "nuggets-12",
    storeSlug: "big-bite-wings",
    name: "Nuggets x12",
    category: "Entradas",
    price: 35,
    description: "Pollo 100% pechuga, empanizado en panko. Crocante perfecto.",
    image:
      "https://images.unsplash.com/photo-1562967914-608f82629710?w=900&q=80",
    available: true,
  },
  {
    slug: "combo-familiar",
    storeSlug: "big-bite-wings",
    name: "Combo Familiar",
    category: "Combos",
    price: 145,
    comparePrice: 175,
    description: "24 wings + 2 papas cheese + 4 bebidas. Para 4 personas.",
    image:
      "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=900&q=80",
    badge: "promo",
    badgeLabel: "Ahorra Bs 30",
    available: true,
  },
  {
    slug: "limonada-jengibre",
    storeSlug: "big-bite-wings",
    name: "Limonada de Jengibre",
    category: "Bebidas",
    price: 18,
    description: "Limón fresco, jengibre y un toque de menta. 500ml.",
    image:
      "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=900&q=80",
    available: true,
  },
  {
    slug: "cheesecake-frutos",
    storeSlug: "big-bite-wings",
    name: "Cheesecake de Frutos Rojos",
    category: "Postres",
    price: 28,
    description: "Base de galleta, queso crema y compota casera de berries.",
    image:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&q=80",
    available: false,
  },
];

export const categories = ["Wings", "Entradas", "Combos", "Bebidas", "Postres"];

export function getProductsByStore(storeSlug: string): MockProduct[] {
  return products.filter((p) => p.storeSlug === storeSlug);
}

export function getProduct(storeSlug: string, productSlug: string): MockProduct | undefined {
  return products.find((p) => p.storeSlug === storeSlug && p.slug === productSlug);
}
