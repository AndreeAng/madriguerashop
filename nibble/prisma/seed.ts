/**
 * Seed inicial — Nibble
 *
 * Crea:
 *  - 5 Templates (1 por vertical)
 *  - 2 Plans (Mensual / Anual)
 *  - 1 Super Admin desde env (SEED_SUPER_ADMIN_EMAIL / PASSWORD)
 *  - 1 Tienda demo "big-bite-wings" con productos, categorías, horarios
 *  - 1 Store Owner para esa tienda
 *
 * Ejecución: `npm run db:seed`
 */

import { PrismaClient, Role, StoreVertical, StoreStatus, BillingCycle } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // ====== TEMPLATES ======
  const templates = await Promise.all([
    db.template.upsert({
      where: { componentKey: "restaurant_v1" },
      update: {},
      create: {
        name: "Restaurante",
        vertical: StoreVertical.RESTAURANT,
        description:
          "Menú con horarios, modificadores y combos. Ideal para wings, pizza, comida rápida y casual.",
        previewUrl: "/templates/restaurant.png",
        componentKey: "restaurant_v1",
        sortOrder: 1,
      },
    }),
    db.template.upsert({
      where: { componentKey: "food_truck_v1" },
      update: {},
      create: {
        name: "Food Truck",
        vertical: StoreVertical.FOOD_TRUCK,
        description: "One-page con ubicación del día, promo destacada y pedido por WhatsApp.",
        previewUrl: "/templates/food-truck.png",
        componentKey: "food_truck_v1",
        sortOrder: 2,
      },
    }),
    db.template.upsert({
      where: { componentKey: "retail_v1" },
      update: {},
      create: {
        name: "Retail",
        vertical: StoreVertical.RETAIL,
        description: "Catálogo con filtros, tallas, variantes y zoom. Moda y deporte.",
        previewUrl: "/templates/retail.png",
        componentKey: "retail_v1",
        sortOrder: 3,
      },
    }),
    db.template.upsert({
      where: { componentKey: "hardware_v1" },
      update: {},
      create: {
        name: "Ferretería",
        vertical: StoreVertical.HARDWARE,
        description: "SKU, stock visible, cotización por WhatsApp. Para quien vende a profesionales.",
        previewUrl: "/templates/hardware.png",
        componentKey: "hardware_v1",
        sortOrder: 4,
      },
    }),
    db.template.upsert({
      where: { componentKey: "services_v1" },
      update: {},
      create: {
        name: "Servicios",
        vertical: StoreVertical.SERVICES,
        description: "Reservas, cotizaciones, no productos. Peluquerías, talleres, consultorios.",
        previewUrl: "/templates/services.png",
        componentKey: "services_v1",
        sortOrder: 5,
      },
    }),
  ]);
  console.log(`✓ ${templates.length} templates`);

  // ====== PLANS ======
  const planStarter = await db.plan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
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
    },
  });

  const planBusiness = await db.plan.upsert({
    where: { slug: "business" },
    update: {},
    create: {
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
    },
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

  // ====== TIENDA DEMO: Big Bite Wings ======
  const restaurantTemplate = templates.find((t) => t.componentKey === "restaurant_v1")!;

  const bigBite = await db.store.upsert({
    where: { slug: "big-bite-wings" },
    update: {},
    create: {
      slug: "big-bite-wings",
      name: "Big Bite Wings",
      vertical: StoreVertical.RESTAURANT,
      status: StoreStatus.ACTIVE,
      description: "Wings que no te dejan parar. 14 sabores, picante a tu medida.",
      logoUrl: null,
      primaryColor: "#dc2626",
      secondaryColor: "#7f1d1d",
      accentColor: "#f59e0b",
      fontFamily: "Inter",
      templateId: restaurantTemplate.id,

      whatsappPhone: "+59171234567",
      email: "hola@bigbitewings.bo",
      addressText: "Av. América Este 1234, Cochabamba",
      city: "Cochabamba",
      lat: -17.378,
      lng: -66.166,

      instagram: "bigbitewings",

      acceptsCashOnDelivery: true,
      acceptsQR: true,

      deliveryEnabled: true,
      pickupEnabled: true,
      defaultDeliveryFee: 10,
      deliveryNote: "Costo final se confirma por WhatsApp",
      freeDeliveryAbove: 150,

      planId: planStarter.id,
      billingCycle: BillingCycle.MONTHLY,

      isPubliclyListed: true,
    },
  });

  // Horarios: Lun–Dom, 11:00–23:00
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    await db.storeHours.upsert({
      where: { storeId_dayOfWeek: { storeId: bigBite.id, dayOfWeek } },
      update: {},
      create: {
        storeId: bigBite.id,
        dayOfWeek,
        openTime: "11:00",
        closeTime: "23:00",
        isClosed: false,
      },
    });
  }

  // Categorías
  const catWings = await db.category.upsert({
    where: { storeId_slug: { storeId: bigBite.id, slug: "wings" } },
    update: {},
    create: { storeId: bigBite.id, name: "Wings", slug: "wings", sortOrder: 1 },
  });

  const catCombos = await db.category.upsert({
    where: { storeId_slug: { storeId: bigBite.id, slug: "combos" } },
    update: {},
    create: { storeId: bigBite.id, name: "Combos", slug: "combos", sortOrder: 2 },
  });

  const catBebidas = await db.category.upsert({
    where: { storeId_slug: { storeId: bigBite.id, slug: "bebidas" } },
    update: {},
    create: { storeId: bigBite.id, name: "Bebidas", slug: "bebidas", sortOrder: 3 },
  });

  // Productos
  const products = [
    {
      slug: "wings-clasicos-bbq",
      name: "Wings Clásicos BBQ",
      description: "12 alitas marinadas 24h, glaseadas con nuestra salsa BBQ ahumada.",
      basePrice: 55,
      categoryId: catWings.id,
      isFeatured: true,
      isBestSeller: true,
    },
    {
      slug: "buffalo-hot",
      name: "Buffalo Hot",
      description: "Las que prendieron NYC. Picante medio-alto, con un toque de mantequilla.",
      basePrice: 58,
      categoryId: catWings.id,
      customLabel: "Solo hoy",
    },
    {
      slug: "honey-mustard",
      name: "Honey Mustard",
      description: "Miel artesanal + mostaza Dijon. Dulce con carácter.",
      basePrice: 60,
      categoryId: catWings.id,
      isNew: true,
    },
    {
      slug: "combo-familiar",
      name: "Combo Familiar",
      description: "24 wings + 2 papas cheese + 4 bebidas. Pídelo antes de las 21:00.",
      basePrice: 145,
      comparePrice: 175,
      categoryId: catCombos.id,
      isFeatured: true,
    },
    {
      slug: "limonada-jengibre",
      name: "Limonada Jengibre",
      description: "Limón, jengibre fresco, hielo. Refrescante.",
      basePrice: 18,
      categoryId: catBebidas.id,
    },
  ];

  for (const p of products) {
    await db.product.upsert({
      where: { storeId_slug: { storeId: bigBite.id, slug: p.slug } },
      update: {},
      create: {
        storeId: bigBite.id,
        ...p,
      },
    });
  }
  console.log(`✓ Tienda demo: ${bigBite.slug} con ${products.length} productos`);

  // Store owner para la tienda demo
  const ownerHash = await bcrypt.hash("owner123change", 10);
  await db.user.upsert({
    where: { username: "owner@bigbitewings.bo" },
    update: {},
    create: {
      username: "owner@bigbitewings.bo",
      email: "owner@bigbitewings.bo",
      passwordHash: ownerHash,
      role: Role.STORE_OWNER,
      fullName: "Romina Tórrez",
      storeId: bigBite.id,
      isActive: true,
    },
  });
  console.log(`✓ Store owner: owner@bigbitewings.bo`);

  console.log("✅ Seed completo.");
}

main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
