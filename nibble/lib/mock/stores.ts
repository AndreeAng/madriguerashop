export type StoreVertical = "RESTAURANT" | "FOOD_TRUCK" | "RETAIL" | "HARDWARE" | "SERVICES";

export type MockStore = {
  slug: string;
  name: string;
  vertical: StoreVertical;
  city: string;
  description: string;
  tagline: string;
  whatsapp: string;
  primaryColor: string;
  logoEmoji: string;
  bannerImage: string;
  ordersThisMonth: number;
  rating: number;
};

export const stores: MockStore[] = [
  {
    slug: "big-bite-wings",
    name: "Big Bite Wings",
    vertical: "RESTAURANT",
    city: "Cochabamba",
    description: "Las mejores alitas de la ciudad. 14 sabores, picante a tu medida.",
    tagline: "Wings que no te dejan parar",
    whatsapp: "+59171234567",
    primaryColor: "#dc2626",
    logoEmoji: "BB",
    bannerImage:
      "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=1600&q=80",
    ordersThisMonth: 412,
    rating: 4.8,
  },
  {
    slug: "nutriarte",
    name: "Nutriarte",
    vertical: "RETAIL",
    city: "Cochabamba",
    description: "Productos saludables, granola artesanal y suplementos.",
    tagline: "Comer bien sin pensarlo",
    whatsapp: "+59172345678",
    primaryColor: "#4f7d3a",
    logoEmoji: "NU",
    bannerImage:
      "https://images.unsplash.com/photo-1505576391880-b3f9d713dc4f?w=1600&q=80",
    ordersThisMonth: 187,
    rating: 4.9,
  },
  {
    slug: "domelux",
    name: "Domelux",
    vertical: "RETAIL",
    city: "Santa Cruz",
    description: "Refrigeración y línea blanca con garantía oficial.",
    tagline: "Tu hogar, fresco y eficiente",
    whatsapp: "+59173456789",
    primaryColor: "#1e40af",
    logoEmoji: "DM",
    bannerImage:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=80",
    ordersThisMonth: 89,
    rating: 4.7,
  },
  {
    slug: "cheese-and-cake",
    name: "Cheese & Cake",
    vertical: "FOOD_TRUCK",
    city: "La Paz",
    description: "Cheesecakes artesanales y pastelería para eventos.",
    tagline: "Cada bocado, un evento",
    whatsapp: "+59174567890",
    primaryColor: "#d97706",
    logoEmoji: "CC",
    bannerImage:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1600&q=80",
    ordersThisMonth: 256,
    rating: 4.9,
  },
  {
    slug: "ferreteria-tunari",
    name: "Ferretería Tunari",
    vertical: "HARDWARE",
    city: "Cochabamba",
    description: "Herramientas pro y materiales para construcción.",
    tagline: "Si lo necesitas, lo tenemos",
    whatsapp: "+59175678901",
    primaryColor: "#92400e",
    logoEmoji: "FT",
    bannerImage:
      "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1600&q=80",
    ordersThisMonth: 143,
    rating: 4.6,
  },
  {
    slug: "estudio-clara",
    name: "Estudio Clara",
    vertical: "SERVICES",
    city: "Cochabamba",
    description: "Peluquería profesional con reservas online.",
    tagline: "Siempre lista, siempre vos",
    whatsapp: "+59176789012",
    primaryColor: "#be185d",
    logoEmoji: "EC",
    bannerImage:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80",
    ordersThisMonth: 98,
    rating: 5.0,
  },
];

export function getStore(slug: string): MockStore | undefined {
  return stores.find((s) => s.slug === slug);
}
