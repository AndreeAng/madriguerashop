/**
 * Seed inicial — Nibble
 *
 * Crea:
 *  - 5 Templates (1 por vertical)
 *  - 2 Plans (Mensual / Anual)
 *  - 1 Super Admin desde env (SEED_SUPER_ADMIN_EMAIL / PASSWORD)
 *  - 5 tiendas demo, una por vertical, navegables públicamente
 *
 * Ejecución: `npm run db:seed`
 *
 * Idempotencia: usa upsert para entidades singleton (Store, User, Category)
 * y delete + createMany para imágenes de producto (refrescan al re-correr).
 */

import {
  PrismaClient,
  Role,
  StoreVertical,
  StoreStatus,
  BillingCycle,
  CouponType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ============== Tipos del DSL ==============

type DemoProductSpec = {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  comparePrice?: number;
  category: string; // referenciamos por nombre para no acoplar al ID
  imageUrl: string;
  isFeatured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  customLabel?: string;
  manageStock?: boolean;
  stock?: number;
  sku?: string;
  /** Variantes opcionales. Cada una puede tener su propio stock para
   *  demostrar el feature de inventario por variante (ej. clavo 9mm con
   *  stock pero 11mm agotado). `price` es ABSOLUTO en BOB; si está null
   *  se usa el `basePrice` del producto. */
  variants?: Array<{
    name: string;
    price?: number | null;
    manageStock?: boolean;
    stock?: number;
  }>;
  /** Si es un servicio reservable: el storefront muestra calendario en
   *  lugar de "Agregar al carrito". Sólo aplica a verticales SERVICES /
   *  BEAUTY típicamente. */
  isBookable?: boolean;
  bookingDurationMin?: number;
  bookingBufferMin?: number;
};

type DemoCategorySpec = { name: string; slug: string };

type DemoHoursSpec = {
  /** Días abiertos (0=Dom, 1=Lun, ..., 6=Sáb). Los demás se marcan cerrados. */
  openDays: number[];
  open: string;
  close: string;
};

type DemoStoreSpec = {
  slug: string;
  name: string;
  vertical: StoreVertical;
  description: string;
  bannerUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  city: string;
  addressText: string;
  whatsappPhone: string;
  email: string;
  instagram?: string;
  defaultDeliveryFee?: number | null;
  freeDeliveryAbove?: number | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  hours: DemoHoursSpec;
  categories: DemoCategorySpec[];
  products: DemoProductSpec[];
  owner: { username: string; email: string; fullName: string };
  /** Banner promocional opcional (uno por tienda demo). Las tiendas con
   *  banner muestran al cliente que el feature existe — vital para
   *  enseñarlo al cliente potencial. */
  banner?: {
    title?: string;
    subtitle?: string;
    imageUrl: string;
    linkUrl?: string;
  };
  /** Popup opcional (modal al entrar). */
  popup?: {
    title: string;
    message: string;
    imageUrl?: string;
    ctaText?: string;
    ctaUrl?: string;
    delaySeconds?: number;
  };
  /** Cupones opcionales. */
  coupons?: Array<{
    code: string;
    description?: string;
    type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
    value: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    usageLimitPerUser?: number;
  }>;
  /** Zonas de delivery con círculos en mapa. */
  deliveryZones?: Array<{
    name: string;
    fee: number;
    estimatedTime?: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
  }>;
};

// ============== Helper de seed ==============

async function seedDemoStore(
  spec: DemoStoreSpec,
  templateId: string,
  planId: string,
  ownerPasswordHash: string,
): Promise<void> {
  const store = await db.store.upsert({
    where: { slug: spec.slug },
    update: {
      // Refrescamos los campos visuales en re-runs para iterar el seed
      name: spec.name,
      description: spec.description,
      bannerUrl: spec.bannerUrl,
      primaryColor: spec.primaryColor,
      secondaryColor: spec.secondaryColor,
      accentColor: spec.accentColor,
      addressText: spec.addressText,
      city: spec.city,
      whatsappPhone: spec.whatsappPhone,
      email: spec.email,
      instagram: spec.instagram ?? null,
      defaultDeliveryFee: spec.defaultDeliveryFee ?? null,
      freeDeliveryAbove: spec.freeDeliveryAbove ?? null,
      deliveryEnabled: spec.deliveryEnabled,
      pickupEnabled: spec.pickupEnabled,
    },
    create: {
      slug: spec.slug,
      name: spec.name,
      vertical: spec.vertical,
      status: StoreStatus.ACTIVE,
      description: spec.description,
      bannerUrl: spec.bannerUrl,
      primaryColor: spec.primaryColor,
      secondaryColor: spec.secondaryColor,
      accentColor: spec.accentColor,
      fontFamily: "Inter",
      templateId,

      whatsappPhone: spec.whatsappPhone,
      email: spec.email,
      addressText: spec.addressText,
      city: spec.city,
      instagram: spec.instagram ?? null,

      acceptsCashOnDelivery: true,
      acceptsQR: true,

      deliveryEnabled: spec.deliveryEnabled,
      pickupEnabled: spec.pickupEnabled,
      defaultDeliveryFee: spec.defaultDeliveryFee ?? null,
      freeDeliveryAbove: spec.freeDeliveryAbove ?? null,

      planId,
      billingCycle: BillingCycle.MONTHLY,
      isPubliclyListed: true,
    },
  });

  // Horarios
  for (let day = 0; day < 7; day++) {
    const isOpen = spec.hours.openDays.includes(day);
    await db.storeHours.upsert({
      where: { storeId_dayOfWeek: { storeId: store.id, dayOfWeek: day } },
      update: {
        openTime: isOpen ? spec.hours.open : "00:00",
        closeTime: isOpen ? spec.hours.close : "00:00",
        isClosed: !isOpen,
      },
      create: {
        storeId: store.id,
        dayOfWeek: day,
        openTime: isOpen ? spec.hours.open : "00:00",
        closeTime: isOpen ? spec.hours.close : "00:00",
        isClosed: !isOpen,
      },
    });
  }

  // Categorías
  const catByName = new Map<string, string>(); // name → id
  for (let i = 0; i < spec.categories.length; i++) {
    const c = spec.categories[i]!;
    const cat = await db.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: c.slug } },
      update: { name: c.name, sortOrder: i + 1 },
      create: { storeId: store.id, name: c.name, slug: c.slug, sortOrder: i + 1 },
    });
    catByName.set(c.name, cat.id);
  }

  // Productos + sus imágenes
  for (const p of spec.products) {
    const categoryId = catByName.get(p.category);
    if (!categoryId) throw new Error(`Categoría ${p.category} no existe en ${spec.slug}`);

    const product = await db.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: p.slug } },
      update: {
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        comparePrice: p.comparePrice ?? null,
        categoryId,
        isFeatured: p.isFeatured ?? false,
        isNew: p.isNew ?? false,
        isBestSeller: p.isBestSeller ?? false,
        customLabel: p.customLabel ?? null,
        manageStock: p.manageStock ?? false,
        stock: p.stock ?? 0,
        sku: p.sku ?? null,
        isActive: true,
        isBookable: p.isBookable ?? false,
        bookingDurationMin: p.bookingDurationMin ?? 30,
        bookingBufferMin: p.bookingBufferMin ?? 0,
      },
      create: {
        storeId: store.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        comparePrice: p.comparePrice ?? null,
        categoryId,
        isFeatured: p.isFeatured ?? false,
        isNew: p.isNew ?? false,
        isBestSeller: p.isBestSeller ?? false,
        customLabel: p.customLabel ?? null,
        manageStock: p.manageStock ?? false,
        stock: p.stock ?? 0,
        sku: p.sku ?? null,
        isBookable: p.isBookable ?? false,
        bookingDurationMin: p.bookingDurationMin ?? 30,
        bookingBufferMin: p.bookingBufferMin ?? 0,
      },
    });

    // Imágenes — reset + recreate para que cambios de URL se reflejen
    await db.productImage.deleteMany({ where: { productId: product.id } });
    await db.productImage.create({
      data: {
        productId: product.id,
        url: p.imageUrl,
        alt: p.name,
        sortOrder: 0,
      },
    });

    // Variantes opcionales. Reseteamos siempre para que el seed sea
    // idempotente: si cambias el spec, las viejas se borran.
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    if (p.variants && p.variants.length > 0) {
      await db.productVariant.createMany({
        data: p.variants.map((v, i) => ({
          productId: product.id,
          name: v.name,
          price: v.price != null ? v.price : null,
          manageStock: v.manageStock ?? false,
          stock: v.stock ?? 0,
          isActive: true,
          sortOrder: i,
          attributes: {},
        })),
      });
    }
  }

  // Owner
  await db.user.upsert({
    where: { username: spec.owner.username },
    update: {
      email: spec.owner.email,
      fullName: spec.owner.fullName,
      passwordHash: ownerPasswordHash,
      storeId: store.id,
    },
    create: {
      username: spec.owner.username,
      email: spec.owner.email,
      passwordHash: ownerPasswordHash,
      role: Role.STORE_OWNER,
      fullName: spec.owner.fullName,
      storeId: store.id,
      isActive: true,
    },
  });

  // Extras del showroom: banner, popup, cupones, zonas. Reseteamos antes
  // (deleteMany por storeId) y recreamos — idempotente y deja el demo en
  // estado canónico aunque hayas tocado cosas a mano en la UI.
  await db.banner.deleteMany({ where: { storeId: store.id } });
  if (spec.banner) {
    await db.banner.create({
      data: {
        storeId: store.id,
        title: spec.banner.title ?? null,
        subtitle: spec.banner.subtitle ?? null,
        imageUrl: spec.banner.imageUrl,
        linkUrl: spec.banner.linkUrl ?? null,
        position: "hero",
        sortOrder: 1,
        isActive: true,
      },
    });
  }

  await db.popup.deleteMany({ where: { storeId: store.id } });
  if (spec.popup) {
    await db.popup.create({
      data: {
        storeId: store.id,
        title: spec.popup.title,
        message: spec.popup.message,
        imageUrl: spec.popup.imageUrl ?? null,
        ctaText: spec.popup.ctaText ?? null,
        ctaUrl: spec.popup.ctaUrl ?? null,
        delaySeconds: spec.popup.delaySeconds ?? 3,
        showOncePerSession: true,
        isActive: true,
      },
    });
  }

  await db.coupon.deleteMany({ where: { storeId: store.id } });
  if (spec.coupons && spec.coupons.length > 0) {
    // Vigencia de los cupones demo: 30 días desde hoy. Si quieres probar
    // "fuera de fecha" en la UI, editás desde el dashboard.
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 30);
    await db.coupon.createMany({
      data: spec.coupons.map((c) => ({
        storeId: store.id,
        code: c.code,
        description: c.description ?? null,
        type: c.type as CouponType,
        value: c.value,
        minOrderAmount: c.minOrderAmount ?? null,
        maxDiscountAmount: c.maxDiscountAmount ?? null,
        usageLimitPerUser: c.usageLimitPerUser ?? null,
        validFrom,
        validTo,
        isActive: true,
      })),
    });
  }

  await db.deliveryZone.deleteMany({ where: { storeId: store.id } });
  if (spec.deliveryZones && spec.deliveryZones.length > 0) {
    for (let i = 0; i < spec.deliveryZones.length; i++) {
      const z = spec.deliveryZones[i]!;
      await db.deliveryZone.create({
        data: {
          storeId: store.id,
          name: z.name,
          fee: z.fee,
          estimatedTime: z.estimatedTime ?? null,
          isActive: true,
          sortOrder: i + 1,
          polygon: {
            type: "circle",
            lat: z.centerLat,
            lng: z.centerLng,
            radiusMeters: z.radiusMeters,
          },
        },
      });
    }
  }

  console.log(
    `✓ ${spec.slug} (${spec.vertical}) — ${spec.categories.length} cats, ${spec.products.length} prods`,
  );
}

// ============== Specs de las tiendas demo ==============
//
// Una por vertical. Cada una elige paleta y catálogo realistas para que un
// futuro cliente del rubro vea "así se vería mi tienda".

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const MON_TO_SAT = [1, 2, 3, 4, 5, 6];
const TUE_TO_SUN = [2, 3, 4, 5, 6, 0];

const demoStores: DemoStoreSpec[] = [
  // ─── RESTAURANT ─────────────────────────────────────────────
  {
    slug: "big-bite-wings",
    name: "Big Bite Wings",
    vertical: StoreVertical.RESTAURANT,
    description: "Wings que no te dejan parar. 14 sabores, picante a tu medida.",
    bannerUrl:
      "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=1920&q=80",
    primaryColor: "#dc2626",
    secondaryColor: "#7f1d1d",
    accentColor: "#f59e0b",
    city: "Cochabamba",
    addressText: "Av. América Este 1234",
    whatsappPhone: "+59171234567",
    email: "hola@bigbitewings.bo",
    instagram: "bigbitewings",
    defaultDeliveryFee: 10,
    freeDeliveryAbove: 150,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: ALL_DAYS, open: "11:00", close: "23:00" },
    categories: [
      { name: "Wings", slug: "wings" },
      { name: "Combos", slug: "combos" },
      { name: "Bebidas", slug: "bebidas" },
    ],
    products: [
      {
        slug: "wings-clasicos-bbq",
        name: "Wings Clásicos BBQ",
        description:
          "Alitas marinadas 24h, glaseadas con nuestra salsa BBQ ahumada.",
        basePrice: 35,
        category: "Wings",
        imageUrl:
          "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
        variants: [
          { name: "6 piezas", price: 35 },
          { name: "12 piezas", price: 55 },
          { name: "18 piezas", price: 75 },
        ],
      },
      {
        slug: "buffalo-hot",
        name: "Buffalo Hot",
        description:
          "Las que prendieron NYC. Picante medio-alto, con un toque de mantequilla.",
        basePrice: 38,
        category: "Wings",
        imageUrl:
          "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=1200&q=80",
        customLabel: "Solo hoy",
        variants: [
          { name: "6 piezas", price: 38 },
          { name: "12 piezas", price: 58 },
          { name: "18 piezas", price: 78 },
        ],
      },
      {
        slug: "honey-mustard",
        name: "Honey Mustard",
        description: "Miel artesanal + mostaza Dijon. Dulce con carácter.",
        basePrice: 40,
        category: "Wings",
        imageUrl:
          "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=1200&q=80",
        isNew: true,
        variants: [
          { name: "6 piezas", price: 40 },
          { name: "12 piezas", price: 60 },
          { name: "18 piezas", price: 80 },
        ],
      },
      {
        slug: "combo-familiar",
        name: "Combo Familiar",
        description:
          "24 wings + 2 papas cheese + 4 bebidas. Pídelo antes de las 21:00.",
        basePrice: 145,
        comparePrice: 175,
        category: "Combos",
        imageUrl:
          "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=1200&q=80",
        isFeatured: true,
      },
      {
        slug: "limonada-jengibre",
        name: "Limonada Jengibre",
        description: "Limón, jengibre fresco, hielo. Refrescante.",
        basePrice: 18,
        category: "Bebidas",
        imageUrl:
          "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&q=80",
      },
    ],
    owner: {
      username: "owner@bigbitewings.bo",
      email: "owner@bigbitewings.bo",
      fullName: "Romina Tórrez",
    },
  },

  // ─── FOOD_TRUCK ─────────────────────────────────────────────
  {
    slug: "la-latita",
    name: "La Latita",
    vertical: StoreVertical.FOOD_TRUCK,
    description:
      "Smashburgers en la calle. Los jueves en El Prado, los sábados en La Recoleta.",
    bannerUrl:
      "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=1920&q=80",
    primaryColor: "#d97706",
    secondaryColor: "#92400e",
    accentColor: "#fbbf24",
    city: "Cochabamba",
    addressText: "Ubicación rotativa — chequea Instagram",
    whatsappPhone: "+59172345678",
    email: "hola@lalatita.bo",
    instagram: "lalatita.cbba",
    defaultDeliveryFee: 12,
    freeDeliveryAbove: null,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: TUE_TO_SUN, open: "18:00", close: "23:30" },
    categories: [
      { name: "Burgers", slug: "burgers" },
      { name: "Acompañamientos", slug: "acompanamientos" },
      { name: "Bebidas", slug: "bebidas" },
    ],
    products: [
      {
        slug: "smash-clasica",
        name: "Smash Clásica",
        description:
          "Doble carne molida del día, queso americano, cebolla caramelizada, salsa secreta. Pan de papa artesanal.",
        basePrice: 38,
        category: "Burgers",
        imageUrl:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
      },
      {
        slug: "doble-cheese",
        name: "Doble Cheese",
        description:
          "Dos smash patties, doble queso cheddar, pickles. Para quienes vienen con hambre.",
        basePrice: 45,
        category: "Burgers",
        imageUrl:
          "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=1200&q=80",
        isFeatured: true,
      },
      {
        slug: "bbq-bacon",
        name: "BBQ Bacon",
        description:
          "Smash patty, tocino crocante, aros de cebolla, BBQ casera. La que pidió todo el mundo el verano pasado.",
        basePrice: 48,
        category: "Burgers",
        imageUrl:
          "https://images.unsplash.com/photo-1606131731446-5568d87113aa?w=1200&q=80",
        isNew: true,
      },
      {
        slug: "papas-truffle",
        name: "Papas Truffle",
        description: "Papas crocantes con aceite trufado, parmesano y perejil.",
        basePrice: 28,
        category: "Acompañamientos",
        imageUrl:
          "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=1200&q=80",
      },
      {
        slug: "coca-vidrio",
        name: "Coca-Cola en vidrio",
        description: "Mexicana, 355ml. Con hielo si quieres.",
        basePrice: 12,
        category: "Bebidas",
        imageUrl:
          "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=1200&q=80",
      },
      {
        slug: "cerveza-artesanal",
        name: "Cerveza artesanal",
        description: "IPA, Stout o Pale Ale — preguntá qué tenemos hoy.",
        basePrice: 25,
        category: "Bebidas",
        imageUrl:
          "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=1200&q=80",
        customLabel: "Rota cada semana",
      },
    ],
    owner: {
      username: "owner@lalatita.bo",
      email: "owner@lalatita.bo",
      fullName: "Iván Salazar",
    },
  },

  // ─── RETAIL ─────────────────────────────────────────────────
  {
    slug: "nutriarte",
    name: "Nutriarte",
    vertical: StoreVertical.RETAIL,
    description:
      "Granolas artesanales, snacks saludables y suplementos. Hechos en Cochabamba con ingredientes locales.",
    bannerUrl:
      "https://images.unsplash.com/photo-1505576391880-b3f9d713dc4f?w=1920&q=80",
    primaryColor: "#15803d",
    secondaryColor: "#14532d",
    accentColor: "#84cc16",
    city: "Cochabamba",
    addressText: "C. España N°456, Casillero 12",
    whatsappPhone: "+59173456789",
    email: "hola@nutriarte.bo",
    instagram: "nutriarte.bo",
    defaultDeliveryFee: 15,
    freeDeliveryAbove: 200,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: MON_TO_SAT, open: "09:00", close: "19:00" },
    categories: [
      { name: "Granolas", slug: "granolas" },
      { name: "Snacks", slug: "snacks" },
      { name: "Suplementos", slug: "suplementos" },
      { name: "Combos", slug: "combos" },
    ],
    products: [
      {
        slug: "granola-coco-almendra",
        name: "Granola Coco & Almendra",
        description:
          "Avena tostada, coco rallado, almendras laminadas y miel de caña. 500g.",
        basePrice: 65,
        category: "Granolas",
        imageUrl:
          "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
        manageStock: true,
        stock: 24,
        sku: "GRA-COC-500",
      },
      {
        slug: "granola-cacao",
        name: "Granola Cacao Puro",
        description:
          "Avena tostada con cacao boliviano, almendras y arándanos. Sin azúcar refinada.",
        basePrice: 72,
        category: "Granolas",
        imageUrl:
          "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&q=80",
        manageStock: true,
        stock: 18,
        sku: "GRA-CAC-500",
      },
      {
        slug: "mix-frutos-secos",
        name: "Mix Frutos Secos Premium",
        description:
          "Almendras, pistachos, nueces de Brasil y arándanos secos. 250g.",
        basePrice: 58,
        category: "Snacks",
        imageUrl:
          "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=1200&q=80",
        isNew: true,
        manageStock: true,
        stock: 12,
        sku: "MIX-PRE-250",
      },
      {
        slug: "protein-bar-cacao",
        name: "Barra de proteína cacao (x6)",
        description:
          "Pack de 6 barras. 12g de proteína por barra, sin azúcar añadida.",
        basePrice: 95,
        comparePrice: 110,
        category: "Snacks",
        imageUrl:
          "https://images.unsplash.com/photo-1622484212850-eb596d769edc?w=1200&q=80",
        manageStock: true,
        stock: 30,
        sku: "BAR-CAC-X6",
      },
      {
        slug: "maca-polvo",
        name: "Maca andina en polvo",
        description: "100% maca peruana premium. 150g. Energía y resistencia.",
        basePrice: 85,
        category: "Suplementos",
        imageUrl:
          "https://images.unsplash.com/photo-1576092762791-dd9e2220abd1?w=1200&q=80",
        manageStock: true,
        stock: 15,
        sku: "MAC-PUR-150",
      },
      {
        slug: "combo-desayuno",
        name: "Combo Desayuno Saludable",
        description:
          "Granola Coco & Almendra + Mix Frutos Secos + 1 barra de regalo.",
        basePrice: 135,
        comparePrice: 155,
        category: "Combos",
        imageUrl:
          "https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?w=1200&q=80",
        isFeatured: true,
        customLabel: "Ahorrás Bs 20",
      },
    ],
    owner: {
      username: "owner@nutriarte.bo",
      email: "owner@nutriarte.bo",
      fullName: "Daniela Rivera",
    },
  },

  // ─── HARDWARE ───────────────────────────────────────────────
  {
    slug: "ferreteria-tunari",
    name: "Ferretería Tunari",
    vertical: StoreVertical.HARDWARE,
    description:
      "Herramientas profesionales y materiales de construcción. Atendemos a maestros, contratistas y particulares.",
    bannerUrl:
      "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1920&q=80",
    primaryColor: "#92400e",
    secondaryColor: "#451a03",
    accentColor: "#f59e0b",
    city: "Cochabamba",
    addressText: "Av. Heroínas 789, Zona Norte",
    whatsappPhone: "+59174567890",
    email: "ventas@ferreteriatunari.bo",
    defaultDeliveryFee: 25,
    freeDeliveryAbove: 500,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: MON_TO_SAT, open: "08:30", close: "18:30" },
    categories: [
      { name: "Eléctricas", slug: "electricas" },
      { name: "Manuales", slug: "manuales" },
      { name: "Accesorios", slug: "accesorios" },
    ],
    products: [
      {
        slug: "taladro-percutor-bosch",
        name: "Taladro percutor Bosch GSB 13 RE",
        description:
          "600W, mandril 13mm, percusión. Ideal para hormigón y mampostería. Garantía 1 año.",
        basePrice: 680,
        category: "Eléctricas",
        imageUrl:
          "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
        manageStock: true,
        stock: 8,
        sku: "BSH-GSB13RE",
      },
      {
        slug: "amoladora-115-makita",
        name: "Amoladora angular Makita 115mm",
        description:
          "720W, disco 115mm. Para corte y desbaste de metales y mampostería.",
        basePrice: 520,
        comparePrice: 580,
        category: "Eléctricas",
        imageUrl:
          "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=1200&q=80",
        manageStock: true,
        stock: 5,
        sku: "MKT-9557HN",
      },
      {
        slug: "juego-llaves-stanley",
        name: "Juego de llaves combinadas Stanley (10 piezas)",
        description: "Llaves boca/corona de 8 a 19mm. Acero cromo-vanadio.",
        basePrice: 220,
        category: "Manuales",
        imageUrl:
          "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=1200&q=80",
        manageStock: true,
        stock: 14,
        sku: "STA-10WRENCH",
      },
      {
        slug: "escalera-aluminio-6p",
        name: "Escalera de aluminio 6 peldaños",
        description: "Plegable, certificación EN 131. Capacidad 150kg.",
        basePrice: 380,
        category: "Manuales",
        imageUrl:
          "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80",
        manageStock: true,
        stock: 6,
        sku: "ALU-6P-PLE",
      },
      {
        slug: "cinta-metrica-5m",
        name: "Cinta métrica 5m Stanley",
        description:
          "Carcasa anti-impacto, freno automático, gancho magnético.",
        basePrice: 45,
        category: "Accesorios",
        imageUrl:
          "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=1200&q=80",
        isNew: true,
        manageStock: true,
        stock: 32,
        sku: "STA-TAPE-5M",
      },
      // Demostración del stock POR VARIANTE: el clavo 9mm está disponible,
      // el 11mm también, el 13mm AGOTADO. El storefront debe mostrar el
      // 13mm con tachadura y "Agotado", y bloquear el "Agregar" si la
      // variante elegida es la agotada.
      {
        slug: "clavos-acero",
        name: "Clavos de acero por kilo",
        description:
          "Clavos con cabeza, acero galvanizado. Varios calibres — elige el que necesitas.",
        basePrice: 18,
        category: "Accesorios",
        imageUrl:
          "https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=1200&q=80",
        sku: "CLV-AC-KG",
        variants: [
          { name: "9mm (1 kg)", price: 18, manageStock: true, stock: 25 },
          { name: "11mm (1 kg)", price: 22, manageStock: true, stock: 8 },
          { name: "13mm (1 kg)", price: 26, manageStock: true, stock: 0 },
          { name: "15mm (1 kg)", price: 30, manageStock: true, stock: 12 },
        ],
      },
    ],
    owner: {
      username: "owner@ferreteriatunari.bo",
      email: "owner@ferreteriatunari.bo",
      fullName: "Gonzalo Mendoza",
    },
  },

  // ─── SERVICES ───────────────────────────────────────────────
  {
    slug: "estudio-clara",
    name: "Estudio Clara",
    vertical: StoreVertical.SERVICES,
    description:
      "Peluquería profesional y estética. Reservas por WhatsApp, te atendemos a tu hora — sin esperas.",
    bannerUrl:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&q=80",
    primaryColor: "#be185d",
    secondaryColor: "#831843",
    accentColor: "#f9a8d4",
    city: "Cochabamba",
    addressText: "C. Sucre 234, edificio Atrium piso 2",
    whatsappPhone: "+59175678901",
    email: "hola@estudioclara.bo",
    instagram: "estudioclara.cbba",
    defaultDeliveryFee: null,
    freeDeliveryAbove: null,
    deliveryEnabled: false,
    pickupEnabled: true,
    hours: { openDays: TUE_TO_SUN, open: "10:00", close: "20:00" },
    categories: [
      { name: "Cabello", slug: "cabello" },
      { name: "Manos", slug: "manos" },
      { name: "Faciales", slug: "faciales" },
    ],
    products: [
      {
        slug: "corte-mujer",
        name: "Corte + lavado + secado",
        description:
          "Diagnóstico capilar, corte personalizado, lavado con productos premium y secado con brushing.",
        basePrice: 120,
        category: "Cabello",
        imageUrl:
          "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
        isBookable: true,
        bookingDurationMin: 60,
        bookingBufferMin: 15,
      },
      {
        slug: "color-completo",
        name: "Color completo",
        description:
          "Diagnóstico, color uniforme raíz a punta, ampolla nutritiva final. ~2.5h.",
        basePrice: 350,
        comparePrice: 400,
        category: "Cabello",
        imageUrl:
          "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80",
        customLabel: "Promo del mes",
        isBookable: true,
        bookingDurationMin: 150,
        bookingBufferMin: 30,
      },
      {
        slug: "mechas-balayage",
        name: "Mechas / Balayage",
        description:
          "Técnica francesa para iluminar de forma natural. Incluye matiz y tratamiento.",
        basePrice: 480,
        category: "Cabello",
        imageUrl:
          "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=1200&q=80",
        isNew: true,
        isBookable: true,
        bookingDurationMin: 180,
        bookingBufferMin: 30,
      },
      {
        slug: "manicure-spa",
        name: "Manicure Spa",
        description:
          "Limado, exfoliación, masaje con aceites esenciales y esmaltado tradicional o gel.",
        basePrice: 95,
        category: "Manos",
        imageUrl:
          "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80",
        isBookable: true,
        bookingDurationMin: 60,
        bookingBufferMin: 10,
      },
      {
        slug: "limpieza-facial",
        name: "Limpieza facial profunda",
        description:
          "Higiene, vapor, extracción, mascarilla calmante e hidratación. ~1h.",
        basePrice: 180,
        category: "Faciales",
        imageUrl:
          "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=80",
        isFeatured: true,
        isBookable: true,
        bookingDurationMin: 60,
        bookingBufferMin: 15,
      },
    ],
    owner: {
      username: "owner@estudioclara.bo",
      email: "owner@estudioclara.bo",
      fullName: "Clara Vargas",
    },
  },

  // ─── BAKERY ────────────────────────────────────────────────
  // Demo realista de panadería artesanal. Aprovecha variantes con stock
  // (algunas tortas se hornean por encargo, otras hay en mostrador), copy
  // de pastelería y horarios típicos.
  {
    slug: "migas-de-casa",
    name: "Migas de Casa",
    vertical: StoreVertical.BAKERY,
    description:
      "Panadería artesanal cochabambina. Masas de fermentación lenta, ingredientes locales y tortas a pedido.",
    bannerUrl:
      "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=1920&q=80",
    primaryColor: "#92400e",
    secondaryColor: "#451a03",
    accentColor: "#fbbf24",
    city: "Cochabamba",
    addressText: "Av. Aroma 1820, Las Cuadras",
    whatsappPhone: "+59172001020",
    email: "hola@migasdecasa.bo",
    instagram: "migasdecasa",
    defaultDeliveryFee: 12,
    freeDeliveryAbove: 120,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: [2, 3, 4, 5, 6, 0], open: "07:00", close: "20:00" },
    categories: [
      { name: "Panes", slug: "panes" },
      { name: "Tortas", slug: "tortas" },
      { name: "Pastelería", slug: "pasteleria" },
    ],
    products: [
      {
        slug: "marraqueta-clasica",
        name: "Marraqueta clásica",
        description:
          "La de toda la vida. Corteza crocante, miga aireada. Horneada cada 3 horas.",
        basePrice: 1.5,
        category: "Panes",
        imageUrl:
          "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
        variants: [
          { name: "6 unidades", price: 9, manageStock: true, stock: 40 },
          { name: "12 unidades", price: 17, manageStock: true, stock: 25 },
          { name: "24 unidades", price: 32, manageStock: true, stock: 12 },
        ],
      },
      {
        slug: "pan-integral-semillas",
        name: "Pan integral con semillas",
        description:
          "Harina integral, linaza, sésamo, chía y girasol. Fermentación 18h.",
        basePrice: 18,
        category: "Panes",
        imageUrl:
          "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=1200&q=80",
        isNew: true,
        manageStock: true,
        stock: 14,
      },
      {
        slug: "baguette-francesa",
        name: "Baguette francesa",
        description: "Receta tradicional. Crujiente afuera, esponjosa adentro.",
        basePrice: 12,
        category: "Panes",
        imageUrl:
          "https://images.unsplash.com/photo-1568471173242-461f0a730452?w=1200&q=80",
        manageStock: true,
        stock: 18,
      },
      {
        slug: "torta-tres-leches",
        name: "Torta tres leches",
        description:
          "La clásica torta empapada en tres leches con merengue italiano. Por encargo 24h.",
        basePrice: 130,
        category: "Tortas",
        imageUrl:
          "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=1200&q=80",
        isFeatured: true,
        customLabel: "Por encargo",
        variants: [
          { name: "8 porciones (1 kg)", price: 130, manageStock: true, stock: 5 },
          { name: "12 porciones (1.5 kg)", price: 180, manageStock: true, stock: 3 },
          { name: "16 porciones (2 kg)", price: 230, manageStock: true, stock: 2 },
        ],
      },
      {
        slug: "cheesecake-frutos-rojos",
        name: "Cheesecake de frutos rojos",
        description:
          "Base de galleta de mantequilla, queso crema, frutos rojos frescos.",
        basePrice: 160,
        category: "Tortas",
        imageUrl:
          "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1200&q=80",
        isBestSeller: true,
        variants: [
          { name: "8 porciones", price: 160, manageStock: true, stock: 2 },
          { name: "12 porciones", price: 220, manageStock: true, stock: 0 },
        ],
      },
      {
        slug: "torta-chocolate-belga",
        name: "Torta de chocolate belga",
        description:
          "Tres pisos de bizcocho de cacao, ganache de chocolate 70%, decorada con virutas.",
        basePrice: 200,
        category: "Tortas",
        imageUrl:
          "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&q=80",
        variants: [
          { name: "8 porciones", price: 200, manageStock: true, stock: 3 },
          { name: "16 porciones", price: 340, manageStock: true, stock: 1 },
        ],
      },
      {
        slug: "croissants-mantequilla",
        name: "Croissants de mantequilla",
        description:
          "Hojaldre laminado a mano con mantequilla francesa. 7 capas.",
        basePrice: 8,
        category: "Pastelería",
        imageUrl:
          "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1200&q=80",
        isFeatured: true,
        variants: [
          { name: "Unidad", price: 8, manageStock: true, stock: 28 },
          { name: "4 unidades", price: 30, manageStock: true, stock: 12 },
          { name: "8 unidades", price: 56, manageStock: true, stock: 4 },
        ],
      },
      {
        slug: "empanadas-pollo",
        name: "Empanadas horneadas de pollo",
        description: "Masa quebrada con pollo desmechado, cebolla y comino.",
        basePrice: 6,
        category: "Pastelería",
        imageUrl:
          "https://images.unsplash.com/photo-1601890515224-2f9b9fa8d2ae?w=1200&q=80",
        variants: [
          { name: "6 unidades", price: 32, manageStock: true, stock: 10 },
          { name: "12 unidades", price: 60, manageStock: true, stock: 5 },
        ],
      },
    ],
    owner: {
      username: "owner@migasdecasa.bo",
      email: "owner@migasdecasa.bo",
      fullName: "Camila Salinas",
    },
    banner: {
      title: "Tortas para tus celebraciones",
      subtitle: "Encarga con 24h de anticipación y elige decoración personalizada.",
      imageUrl:
        "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=1600&q=80",
      linkUrl: "/migas-de-casa#cat-tortas",
    },
    popup: {
      title: "¡Bienvenida al horno!",
      message:
        "Encargá tu torta con un día de anticipación. Tres leches, cheesecake y chocolate belga disponibles toda la semana.",
      imageUrl:
        "https://images.unsplash.com/photo-1551404973-761c83cd8339?w=900&q=80",
      ctaText: "Ver tortas",
      ctaUrl: "/migas-de-casa#cat-tortas",
      delaySeconds: 4,
    },
    coupons: [
      {
        code: "PANALENA",
        description: "Bienvenida a primer pedido",
        type: "PERCENTAGE",
        value: 10,
        minOrderAmount: 30,
        maxDiscountAmount: 30,
        usageLimitPerUser: 1,
      },
      {
        code: "DULCEMARTES",
        description: "Promo martes: envío gratis",
        type: "FREE_SHIPPING",
        value: 0,
        minOrderAmount: 50,
      },
    ],
    deliveryZones: [
      {
        name: "Norte (Las Cuadras / Tupuraya)",
        fee: 12,
        estimatedTime: "20–35 min",
        centerLat: -17.382,
        centerLng: -66.157,
        radiusMeters: 2500,
      },
      {
        name: "Centro (Plaza 14 / La Recoleta)",
        fee: 18,
        estimatedTime: "30–45 min",
        centerLat: -17.394,
        centerLng: -66.165,
        radiusMeters: 1800,
      },
      {
        name: "Sur (Sarcobamba / Villa Pagador)",
        fee: 25,
        estimatedTime: "40–60 min",
        centerLat: -17.420,
        centerLng: -66.175,
        radiusMeters: 3000,
      },
    ],
  },

  // ─── GROCERY ───────────────────────────────────────────────
  // Almacén de barrio. Variantes son presentaciones (1kg, 5kg, sachet,
  // botella). Catálogo curado para mostrar productos esenciales.
  {
    slug: "almacen-del-barrio",
    name: "Almacén del Barrio",
    vertical: StoreVertical.GROCERY,
    description:
      "Tu almacén de confianza. Productos básicos a precios justos, entrega rápida en la zona norte de Cochabamba.",
    bannerUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&q=80",
    primaryColor: "#0f766e",
    secondaryColor: "#134e4a",
    accentColor: "#fbbf24",
    city: "Cochabamba",
    addressText: "Calle Bolívar 245, Sarcobamba",
    whatsappPhone: "+59171234500",
    email: "ventas@almacendelbarrio.bo",
    instagram: "almacendelbarrio",
    defaultDeliveryFee: 8,
    freeDeliveryAbove: 80,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: ALL_DAYS, open: "07:00", close: "22:00" },
    categories: [
      { name: "Lácteos y Huevos", slug: "lacteos" },
      { name: "Despensa", slug: "despensa" },
      { name: "Bebidas", slug: "bebidas" },
      { name: "Limpieza", slug: "limpieza" },
    ],
    products: [
      {
        slug: "leche-pil-entera",
        name: "Leche PIL entera",
        description: "Pasteurizada, larga vida. Sachet o tetrabrik.",
        basePrice: 7,
        category: "Lácteos y Huevos",
        imageUrl:
          "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=1200&q=80",
        isBestSeller: true,
        variants: [
          { name: "Sachet 1L", price: 7, manageStock: true, stock: 60 },
          { name: "Tetrabrik 1L", price: 9, manageStock: true, stock: 35 },
          { name: "Galón 2L", price: 14, manageStock: true, stock: 18 },
        ],
      },
      {
        slug: "huevos-rosados",
        name: "Huevos rosados de granja",
        description: "Frescos, de gallinas pasteureadas locales.",
        basePrice: 22,
        category: "Lácteos y Huevos",
        imageUrl:
          "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=1200&q=80",
        isFeatured: true,
        variants: [
          { name: "1/2 docena", price: 11, manageStock: true, stock: 25 },
          { name: "Docena", price: 22, manageStock: true, stock: 30 },
          { name: "30 unidades (maple)", price: 52, manageStock: true, stock: 8 },
        ],
      },
      {
        slug: "queso-criollo",
        name: "Queso criollo fresco",
        description: "Queso del valle, ideal para sándwich y pizza casera.",
        basePrice: 18,
        category: "Lácteos y Huevos",
        imageUrl:
          "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=1200&q=80",
        variants: [
          { name: "250 g", price: 18, manageStock: true, stock: 12 },
          { name: "500 g", price: 34, manageStock: true, stock: 7 },
          { name: "1 kg", price: 65, manageStock: true, stock: 2 },
        ],
      },
      {
        slug: "arroz-diamante",
        name: "Arroz Diamante grano largo",
        description: "Arroz boliviano, grano largo. Para todos los días.",
        basePrice: 14,
        category: "Despensa",
        imageUrl:
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1200&q=80",
        isBestSeller: true,
        variants: [
          { name: "1 kg", price: 14, manageStock: true, stock: 50 },
          { name: "2 kg", price: 26, manageStock: true, stock: 28 },
          { name: "5 kg", price: 62, manageStock: true, stock: 10 },
        ],
      },
      {
        slug: "aceite-fino",
        name: "Aceite Fino de soya",
        description: "Aceite vegetal refinado, para cocinar y freír.",
        basePrice: 18,
        category: "Despensa",
        imageUrl:
          "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=1200&q=80",
        variants: [
          { name: "900 ml", price: 18, manageStock: true, stock: 22 },
          { name: "2 L", price: 38, manageStock: true, stock: 14 },
          { name: "5 L (bidón)", price: 88, manageStock: true, stock: 4 },
        ],
      },
      {
        slug: "azucar-blanca",
        name: "Azúcar blanca refinada",
        description: "Azúcar de caña refinada, ideal para repostería.",
        basePrice: 7,
        category: "Despensa",
        imageUrl:
          "https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=1200&q=80",
        variants: [
          { name: "1 kg", price: 7, manageStock: true, stock: 40 },
          { name: "5 kg", price: 32, manageStock: true, stock: 12 },
        ],
      },
      {
        slug: "coca-cola-2l",
        name: "Coca-Cola 2L",
        description: "La de toda la vida. Bien fría.",
        basePrice: 14,
        category: "Bebidas",
        imageUrl:
          "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=1200&q=80",
        manageStock: true,
        stock: 45,
      },
      {
        slug: "agua-vital",
        name: "Agua Vital purificada",
        description: "Agua de mesa boliviana. Sin gas.",
        basePrice: 4,
        category: "Bebidas",
        imageUrl:
          "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=1200&q=80",
        variants: [
          { name: "600 ml", price: 4, manageStock: true, stock: 80 },
          { name: "2 L", price: 9, manageStock: true, stock: 50 },
          { name: "Bidón 5 L", price: 18, manageStock: true, stock: 25 },
        ],
      },
      {
        slug: "lavandina",
        name: "Lavandina concentrada",
        description: "Desinfectante multisuperficies.",
        basePrice: 12,
        category: "Limpieza",
        imageUrl:
          "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=1200&q=80",
        variants: [
          { name: "1 L", price: 12, manageStock: true, stock: 30 },
          { name: "5 L", price: 50, manageStock: true, stock: 8 },
        ],
      },
    ],
    owner: {
      username: "owner@almacendelbarrio.bo",
      email: "owner@almacendelbarrio.bo",
      fullName: "Roberto Mamani",
    },
    banner: {
      title: "Delivery gratis arriba de Bs 80",
      subtitle: "Pide hasta las 8pm y te llegan los productos ese mismo día.",
      imageUrl:
        "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1600&q=80",
    },
    popup: {
      title: "¿Tu lista de compras lista?",
      message:
        "Pedinos por WhatsApp con la lista escrita y te armamos el pedido. Como en la tienda de toda la vida, pero a domicilio.",
      ctaText: "Empezar pedido",
      ctaUrl: "https://wa.me/59171234500",
      delaySeconds: 5,
    },
    coupons: [
      {
        code: "VECINO5",
        description: "5% en tu próxima compra para clientes recurrentes",
        type: "PERCENTAGE",
        value: 5,
        minOrderAmount: 50,
        maxDiscountAmount: 20,
        usageLimitPerUser: 3,
      },
    ],
    deliveryZones: [
      {
        name: "Sarcobamba y alrededores",
        fee: 8,
        estimatedTime: "15–25 min",
        centerLat: -17.378,
        centerLng: -66.156,
        radiusMeters: 1500,
      },
      {
        name: "Norte expandida (hasta Cala Cala)",
        fee: 15,
        estimatedTime: "25–40 min",
        centerLat: -17.380,
        centerLng: -66.165,
        radiusMeters: 3500,
      },
    ],
  },

  // ─── BEAUTY ────────────────────────────────────────────────
  // Salón + venta de productos. Combinación clásica: servicios sin
  // stock + productos físicos con tonos/variantes.
  {
    slug: "estudio-bella",
    name: "Estudio Bella",
    vertical: StoreVertical.BEAUTY,
    description:
      "Salón profesional y tienda de productos. Manicure, cortes, maquillaje y skincare seleccionado.",
    bannerUrl:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&q=80",
    primaryColor: "#a21caf",
    secondaryColor: "#581c87",
    accentColor: "#f0abfc",
    city: "Cochabamba",
    addressText: "Av. Beni 678, Cala Cala",
    whatsappPhone: "+59169123456",
    email: "hola@estudiobella.bo",
    instagram: "estudiobella.cbba",
    defaultDeliveryFee: 15,
    freeDeliveryAbove: 200,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: [1, 2, 3, 4, 5, 6], open: "09:00", close: "20:00" },
    categories: [
      { name: "Servicios", slug: "servicios" },
      { name: "Skincare", slug: "skincare" },
      { name: "Maquillaje", slug: "maquillaje" },
    ],
    products: [
      {
        slug: "manicure-clasica",
        name: "Manicure clásica",
        description:
          "Limado, cutícula, esmaltado de color a elección. Duración 45 min.",
        basePrice: 60,
        category: "Servicios",
        imageUrl:
          "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80",
        isFeatured: true,
        isBestSeller: true,
        isBookable: true,
        bookingDurationMin: 45,
        bookingBufferMin: 15,
      },
      {
        slug: "manicure-decoracion",
        name: "Manicure con decoración",
        description:
          "Diseño a elección: francés, glitter, arte mano alzada, pedrería. Contanos en las notas qué estilo te gusta.",
        basePrice: 95,
        category: "Servicios",
        imageUrl:
          "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=1200&q=80",
        isBookable: true,
        bookingDurationMin: 75,
        bookingBufferMin: 15,
      },
      {
        slug: "corte-peinado",
        name: "Corte + peinado",
        description: "Lavado, corte personalizado y peinado de salida.",
        basePrice: 120,
        category: "Servicios",
        imageUrl:
          "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80",
        isFeatured: true,
        isBookable: true,
        bookingDurationMin: 60,
        bookingBufferMin: 15,
      },
      {
        slug: "maquillaje-evento",
        name: "Maquillaje para evento",
        description:
          "Maquillaje profesional con productos premium. Incluye pestañas.",
        basePrice: 180,
        category: "Servicios",
        imageUrl:
          "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&q=80",
        customLabel: "Por reserva",
        isBookable: true,
        bookingDurationMin: 90,
        bookingBufferMin: 20,
      },
      {
        slug: "crema-hidratante-facial",
        name: "Crema hidratante facial",
        description:
          "Con ácido hialurónico y vitamina E. Para piel normal a seca.",
        basePrice: 85,
        category: "Skincare",
        imageUrl:
          "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80",
        isFeatured: true,
        variants: [
          { name: "50 ml", price: 85, manageStock: true, stock: 12 },
          { name: "100 ml", price: 150, manageStock: true, stock: 6 },
        ],
      },
      {
        slug: "suero-vitamina-c",
        name: "Suero de Vitamina C",
        description:
          "Antioxidante, ilumina y unifica el tono. Aplicar de día.",
        basePrice: 110,
        category: "Skincare",
        imageUrl:
          "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80",
        isNew: true,
        manageStock: true,
        stock: 8,
      },
      {
        slug: "labial-mate",
        name: "Labial mate de larga duración",
        description: "Fórmula no resecante. 8h de duración real.",
        basePrice: 65,
        category: "Maquillaje",
        imageUrl:
          "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=1200&q=80",
        isBestSeller: true,
        variants: [
          { name: "Rojo cereza", price: 65, manageStock: true, stock: 9 },
          { name: "Rosa palo", price: 65, manageStock: true, stock: 7 },
          { name: "Nude clásico", price: 65, manageStock: true, stock: 0 },
          { name: "Marrón terracota", price: 65, manageStock: true, stock: 4 },
        ],
      },
      {
        slug: "base-maquillaje",
        name: "Base de maquillaje fluida",
        description: "Cobertura media, acabado natural. Incluye protección SPF 15.",
        basePrice: 120,
        category: "Maquillaje",
        imageUrl:
          "https://images.unsplash.com/photo-1631214540242-3cd8c4b0b3b2?w=1200&q=80",
        variants: [
          { name: "Tono claro", price: 120, manageStock: true, stock: 6 },
          { name: "Tono medio", price: 120, manageStock: true, stock: 8 },
          { name: "Tono oscuro", price: 120, manageStock: true, stock: 4 },
        ],
      },
    ],
    owner: {
      username: "owner@estudiobella.bo",
      email: "owner@estudiobella.bo",
      fullName: "Bella Quispe",
    },
    banner: {
      title: "Mes de Madres — 20% off",
      subtitle: "Maquillaje profesional + cuidado facial. Reserva tu turno por WhatsApp.",
      imageUrl:
        "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1600&q=80",
      linkUrl: "https://wa.me/59169123456",
    },
    popup: {
      title: "Primer turno con descuento",
      message:
        "Si es tu primera vez en Estudio Bella, tienes 15% off en cualquier servicio. Reserva tu turno por WhatsApp con código BELLA15.",
      imageUrl:
        "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=900&q=80",
      ctaText: "Reservar turno",
      ctaUrl: "https://wa.me/59169123456",
      delaySeconds: 3,
    },
    coupons: [
      {
        code: "BELLA15",
        description: "15% para nuevos clientes — servicios y productos",
        type: "PERCENTAGE",
        value: 15,
        maxDiscountAmount: 40,
        usageLimitPerUser: 1,
      },
      {
        code: "ENVIOGRATIS",
        description: "Productos a domicilio sin costo arriba de Bs 200",
        type: "FREE_SHIPPING",
        value: 0,
        minOrderAmount: 200,
      },
    ],
    deliveryZones: [
      {
        name: "Cala Cala / Tupuraya",
        fee: 15,
        estimatedTime: "30–45 min",
        centerLat: -17.385,
        centerLng: -66.163,
        radiusMeters: 2200,
      },
      {
        name: "Centro / Recoleta",
        fee: 20,
        estimatedTime: "45 min – 1 h",
        centerLat: -17.395,
        centerLng: -66.165,
        radiusMeters: 2000,
      },
    ],
  },

  // ─── HEALTH ────────────────────────────────────────────────
  // Farmacia comunitaria. Variantes son presentaciones / dosis.
  {
    slug: "farmacia-sana-vida",
    name: "Farmacia Sana Vida",
    vertical: StoreVertical.HEALTH,
    description:
      "Tu farmacia de confianza. Medicamentos OTC, vitaminas y cuidado personal. Receta médica via WhatsApp.",
    bannerUrl:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1920&q=80",
    primaryColor: "#15803d",
    secondaryColor: "#14532d",
    accentColor: "#86efac",
    city: "Cochabamba",
    addressText: "Av. Heroínas 540, Centro",
    whatsappPhone: "+59172112233",
    email: "contacto@sanavida.bo",
    instagram: "sanavida.farmacia",
    defaultDeliveryFee: 10,
    freeDeliveryAbove: 100,
    deliveryEnabled: true,
    pickupEnabled: true,
    hours: { openDays: ALL_DAYS, open: "08:00", close: "22:00" },
    categories: [
      { name: "Medicamentos OTC", slug: "otc" },
      { name: "Vitaminas y Suplementos", slug: "vitaminas" },
      { name: "Cuidado Personal", slug: "cuidado-personal" },
    ],
    products: [
      {
        slug: "paracetamol-500",
        name: "Paracetamol 500 mg",
        description:
          "Analgésico y antipirético. Para dolores leves y fiebre.",
        basePrice: 8,
        category: "Medicamentos OTC",
        imageUrl:
          "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1200&q=80",
        isBestSeller: true,
        variants: [
          { name: "10 tabletas", price: 8, manageStock: true, stock: 80 },
          { name: "30 tabletas", price: 22, manageStock: true, stock: 35 },
        ],
      },
      {
        slug: "ibuprofeno-400",
        name: "Ibuprofeno 400 mg",
        description:
          "Antiinflamatorio. Útil para dolor muscular y cefalea moderada.",
        basePrice: 12,
        category: "Medicamentos OTC",
        imageUrl:
          "https://images.unsplash.com/photo-1550572017-edd951b55104?w=1200&q=80",
        variants: [
          { name: "10 cápsulas", price: 12, manageStock: true, stock: 60 },
          { name: "30 cápsulas", price: 32, manageStock: true, stock: 22 },
        ],
      },
      {
        slug: "loratadina",
        name: "Loratadina 10 mg",
        description:
          "Antialérgico no sedante. Para alergias estacionales.",
        basePrice: 15,
        category: "Medicamentos OTC",
        imageUrl:
          "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=1200&q=80",
        manageStock: true,
        stock: 18,
      },
      {
        slug: "suero-rehidratante",
        name: "Suero rehidratante oral",
        description: "Reposición de sales y electrolitos. Sabor naranja.",
        basePrice: 9,
        category: "Medicamentos OTC",
        imageUrl:
          "https://images.unsplash.com/photo-1606206522398-de42cf7d51a8?w=1200&q=80",
        isFeatured: true,
        variants: [
          { name: "500 ml", price: 9, manageStock: true, stock: 24 },
          { name: "1 L", price: 16, manageStock: true, stock: 12 },
        ],
      },
      {
        slug: "vitamina-c-500",
        name: "Vitamina C 500 mg",
        description: "Refuerza el sistema inmune. Sabor naranja masticable.",
        basePrice: 28,
        category: "Vitaminas y Suplementos",
        imageUrl:
          "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=1200&q=80",
        isBestSeller: true,
        variants: [
          { name: "30 tabletas", price: 28, manageStock: true, stock: 22 },
          { name: "60 tabletas", price: 52, manageStock: true, stock: 14 },
          { name: "100 tabletas", price: 82, manageStock: true, stock: 6 },
        ],
      },
      {
        slug: "multivitaminico",
        name: "Multivitamínico diario",
        description:
          "Complejo con 12 vitaminas y minerales. 1 tableta al día.",
        basePrice: 65,
        category: "Vitaminas y Suplementos",
        imageUrl:
          "https://images.unsplash.com/photo-1626516164444-31f4e3ac02f8?w=1200&q=80",
        isNew: true,
        manageStock: true,
        stock: 10,
      },
      {
        slug: "omega-3",
        name: "Omega 3 - aceite de pescado",
        description:
          "1000 mg por cápsula. Apoya corazón, cerebro y articulaciones.",
        basePrice: 95,
        category: "Vitaminas y Suplementos",
        imageUrl:
          "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&q=80",
        manageStock: true,
        stock: 8,
      },
      {
        slug: "alcohol-gel",
        name: "Alcohol en gel 70°",
        description: "Antibacterial. Acción rápida, no reseca.",
        basePrice: 6,
        category: "Cuidado Personal",
        imageUrl:
          "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=1200&q=80",
        variants: [
          { name: "60 ml (bolsillo)", price: 6, manageStock: true, stock: 45 },
          { name: "250 ml", price: 18, manageStock: true, stock: 25 },
          { name: "1 L", price: 55, manageStock: true, stock: 12 },
        ],
      },
      {
        slug: "mascarillas-quirurgicas",
        name: "Mascarillas quirúrgicas tricapa",
        description: "Caja sellada. Uso médico, triple capa con filtro.",
        basePrice: 25,
        category: "Cuidado Personal",
        imageUrl:
          "https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=1200&q=80",
        variants: [
          { name: "Caja 10 unidades", price: 25, manageStock: true, stock: 30 },
          { name: "Caja 50 unidades", price: 95, manageStock: true, stock: 12 },
        ],
      },
    ],
    owner: {
      username: "owner@sanavida.bo",
      email: "owner@sanavida.bo",
      fullName: "Dra. Patricia Vega",
    },
    banner: {
      title: "Entrega en 30 minutos en el centro",
      subtitle: "Si tu emergencia es urgente, contactanos por WhatsApp para coordinar.",
      imageUrl:
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1600&q=80",
      linkUrl: "https://wa.me/59172112233",
    },
    popup: {
      title: "¿Tienes receta médica?",
      message:
        "Subila por WhatsApp con tu pedido y verificamos disponibilidad inmediata. Atención farmacéutica con tu prescripción al lado.",
      ctaText: "Enviar receta",
      ctaUrl: "https://wa.me/59172112233",
      delaySeconds: 4,
    },
    coupons: [
      {
        code: "SALUD20",
        description: "20% off en vitaminas y suplementos",
        type: "PERCENTAGE",
        value: 20,
        maxDiscountAmount: 50,
        usageLimitPerUser: 2,
      },
      {
        code: "URGENCIA",
        description: "Envío gratis para pedidos arriba de Bs 100",
        type: "FREE_SHIPPING",
        value: 0,
        minOrderAmount: 100,
      },
    ],
    deliveryZones: [
      {
        name: "Centro (entrega rápida)",
        fee: 10,
        estimatedTime: "15–30 min",
        centerLat: -17.394,
        centerLng: -66.157,
        radiusMeters: 1500,
      },
      {
        name: "Zonas aledañas",
        fee: 18,
        estimatedTime: "30–45 min",
        centerLat: -17.394,
        centerLng: -66.157,
        radiusMeters: 4000,
      },
    ],
  },
];

// ============== Main ==============

async function main() {
  console.log("🌱 Iniciando seed...");

  // ====== TEMPLATES ======
  // Cada spec se usa tanto en `create` como en `update` — así un re-run del
  // seed actualiza name/description/sortOrder en lugar de quedar pegado a
  // los valores de la primera corrida.
  const templateSpecs = [
    {
      name: "Restaurante",
      vertical: StoreVertical.RESTAURANT,
      description:
        "Menú con horarios, modificadores y combos. Ideal para wings, pizza, comida rápida y casual.",
      previewUrl: "/templates/restaurant.png",
      componentKey: "restaurant_v1",
      sortOrder: 1,
    },
    {
      name: "Food Truck",
      vertical: StoreVertical.FOOD_TRUCK,
      description: "One-page con ubicación del día, promo destacada y pedido por WhatsApp.",
      previewUrl: "/templates/food-truck.png",
      componentKey: "food_truck_v1",
      sortOrder: 2,
    },
    {
      name: "Retail",
      vertical: StoreVertical.RETAIL,
      description: "Catálogo con filtros, tallas, variantes y zoom. Moda y deporte.",
      previewUrl: "/templates/retail.png",
      componentKey: "retail_v1",
      sortOrder: 3,
    },
    {
      name: "Ferretería",
      vertical: StoreVertical.HARDWARE,
      description: "SKU, stock visible, cotización por WhatsApp. Para quien vende a profesionales.",
      previewUrl: "/templates/hardware.png",
      componentKey: "hardware_v1",
      sortOrder: 4,
    },
    {
      name: "Servicios",
      vertical: StoreVertical.SERVICES,
      description: "Reservas, cotizaciones, no productos. Peluquerías, talleres, consultorios.",
      previewUrl: "/templates/services.png",
      componentKey: "services_v1",
      sortOrder: 5,
    },
    {
      name: "Panadería",
      vertical: StoreVertical.BAKERY,
      description: "Catálogo de panes, tortas y pastelería. Encargos por anticipado con notas para la pastelería.",
      previewUrl: "/templates/bakery.png",
      componentKey: "bakery_v1",
      sortOrder: 6,
    },
    {
      name: "Almacén",
      vertical: StoreVertical.GROCERY,
      description: "Abarrotes con presentaciones múltiples. Pensado para listas de compra rápida del barrio.",
      previewUrl: "/templates/grocery.png",
      componentKey: "grocery_v1",
      sortOrder: 7,
    },
    {
      name: "Belleza",
      vertical: StoreVertical.BEAUTY,
      description: "Mix de servicios (manicure, cortes) y productos (skincare, maquillaje). Reservas por WhatsApp.",
      previewUrl: "/templates/beauty.png",
      componentKey: "beauty_v1",
      sortOrder: 8,
    },
    {
      name: "Farmacia",
      vertical: StoreVertical.HEALTH,
      description: "Catálogo de medicamentos OTC y productos de salud. Subida de receta médica al pedido.",
      previewUrl: "/templates/health.png",
      componentKey: "health_v1",
      sortOrder: 9,
    },
    {
      name: "Otro rubro",
      vertical: StoreVertical.OTHER,
      description: "Plantilla flexible para cualquier vertical no listada. Catálogo simple con WhatsApp.",
      previewUrl: "/templates/other.png",
      componentKey: "other_v1",
      sortOrder: 10,
    },
  ];
  const templates = await Promise.all(
    templateSpecs.map((spec) =>
      db.template.upsert({
        where: { componentKey: spec.componentKey },
        update: spec,
        create: spec,
      }),
    ),
  );
  console.log(`✓ ${templates.length} templates`);

  const templateByVertical = new Map(
    templates.map((t) => [t.vertical, t.id]),
  );

  // ====== PLANS ======
  // Specs como const para que el upsert haga update con los mismos valores
  // — re-runs del seed actualizan precios/features sin romper FKs.
  const starterSpec = {
    name: "Starter",
    slug: "starter",
    description: "Un plan, todo incluido. Sin tiers, sin upsells, sin sorpresas.",
    monthlyPriceBob: 500,
    yearlyPriceBob: 6000,
    maxProducts: null,
    maxOrdersPerMonth: null,
    maxStaff: 3,
    maxImagesPerProduct: 5,
    removeWatermark: true,
    prioritySupport: false,
    dynamicQR: false,
    multiBranch: false,
    advancedAnalytics: true,
    emailMarketing: false,
    aiChatbot: false,
    customCss: false,
    sortOrder: 1,
  };
  const businessSpec = {
    name: "Business",
    slug: "business",
    description: "Para tiendas con varias sucursales o necesidades avanzadas.",
    monthlyPriceBob: 1200,
    yearlyPriceBob: 14400,
    maxProducts: null,
    maxOrdersPerMonth: null,
    maxStaff: 10,
    maxImagesPerProduct: 10,
    removeWatermark: true,
    prioritySupport: true,
    dynamicQR: true,
    multiBranch: true,
    advancedAnalytics: true,
    emailMarketing: true,
    aiChatbot: true,
    customCss: true,
    sortOrder: 2,
  };
  const planStarter = await db.plan.upsert({
    where: { slug: "starter" },
    update: starterSpec,
    create: starterSpec,
  });
  const planBusiness = await db.plan.upsert({
    where: { slug: "business" },
    update: businessSpec,
    create: businessSpec,
  });
  console.log(`✓ 2 plans (${planStarter.slug}, ${planBusiness.slug})`);

  // ====== SUPER ADMIN ======
  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const superPass = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!superEmail || !superPass) {
    console.warn("⚠ SEED_SUPER_ADMIN_EMAIL / PASSWORD no seteados. Salto super admin.");
  } else {
    const passwordHash = await bcrypt.hash(superPass, 10);
    await db.user.upsert({
      where: { username: superEmail },
      update: {},
      create: {
        username: superEmail,
        email: superEmail,
        passwordHash,
        role: Role.SUPER_ADMIN,
        fullName: "Nibble Admin",
        isActive: true,
      },
    });
    console.log(`✓ Super admin: ${superEmail}`);
  }

  // ====== TIENDAS DEMO ======
  // Si la password no está seteada, saltamos la creación de tiendas demo
  // en lugar de fallar duro. Útil para correr el seed en staging cuando
  // solo se quiere templates + plans + super admin.
  const demoPassword = process.env.SEED_DEMO_OWNER_PASSWORD;
  if (!demoPassword) {
    console.warn(
      "⚠ SEED_DEMO_OWNER_PASSWORD no seteada — saltando tiendas demo.",
    );
    console.log("✓ Seed completado (sólo templates + plans + super admin).");
    return;
  }
  const ownerHash = await bcrypt.hash(demoPassword, 10);

  for (const spec of demoStores) {
    const templateId = templateByVertical.get(spec.vertical);
    if (!templateId) {
      console.warn(`⚠ Sin template para ${spec.vertical}, salto ${spec.slug}`);
      continue;
    }
    await seedDemoStore(spec, templateId, planStarter.id, ownerHash);
  }

  // ====== SAAS SETTINGS singleton ======
  // Sembrar explícitamente para que el super admin tenga valores visibles en
  // /admin/settings desde el primer arranque. Si el row ya existe, no tocamos.
  await db.saasSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      paymentQrUrl: process.env.SAAS_PAYMENT_QR_URL || null,
      paymentInstructions:
        process.env.SAAS_PAYMENT_INSTRUCTIONS ||
        "Escanea el QR y paga el monto exacto. Sube el comprobante para que verifiquemos.",
      billingInvoicePrefix: process.env.BILLING_INVOICE_PREFIX || "NIB-",
      billingDueDays: Number(process.env.BILLING_DUE_DAYS) || 7,
      billingGraceDays: Number(process.env.BILLING_GRACE_DAYS) || 5,
      featureDynamicQr: process.env.FEATURE_DYNAMIC_QR === "true",
      featureAiChatbot: process.env.FEATURE_AI_CHATBOT === "true",
      featureMultiBranch: process.env.FEATURE_MULTI_BRANCH === "true",
    },
    update: {},
  });
  console.log(`✓ SaasSettings singleton listo`);

  // ====== BILLING COUNTER ======
  // Inicializa el contador atómico para invoice numbers en 0 si no existe.
  await db.billingCounter.upsert({
    where: { id: "invoice" },
    create: { id: "invoice", current: 0 },
    update: {},
  });
  console.log(`✓ BillingCounter inicializado`);

  console.log(
    `✅ Seed completo. ${demoStores.length} tiendas demo, una por vertical.`,
  );
  console.log(
    `   Logins de prueba: ${demoStores.map((s) => s.owner.username).join(", ")}`,
  );
  console.log(
    `   Password: el valor que pusiste en SEED_DEMO_OWNER_PASSWORD (no se imprime).`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
