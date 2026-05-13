"use server";

import crypto from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import {
  Prisma,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant/resolve";
import { readGuestToken } from "@/lib/cart/cookies";
import { sendEmailBackground } from "@/lib/email/send";
import { orderCreatedOwnerEmail } from "@/lib/email/templates/order";
import { audit } from "@/lib/audit/log";
import { rateLimit, getClientIp, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { normalizePhoneBO, PHONE_BO_RE } from "@/lib/auth/identifiers";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import {
  isProductAvailableNow,
  isStoreOpenNow,
} from "@/lib/storefront/availability";
import { buildWhatsAppUrl, formatBobAmount } from "@/lib/utils";
import { appUrl } from "@/lib/email/client";

// ============== Tipos ==============

export type CreateOrderState = {
  ok?: { trackingToken: string; orderNumber: number; whatsappUrl: string };
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "customerName"
      | "customerPhone"
      | "customerEmail"
      | "deliveryAddress"
      | "deliveryZoneId"
      | "paymentMethod"
      | "paymentProofUrl"
      | "couponCode",
      string
    >
  >;
};

// ============== Schema ==============

// La regex `PHONE_BO_RE` vive en `lib/auth/identifiers.ts` — fuente única.
const phoneRefiner = (v: string) => PHONE_BO_RE.test(v.replace(/[\s-]/g, ""));

const createOrderSchema = z
  .object({
    storeSlug: z.string().min(1),
    customerName: z.string().trim().min(2, "Ingresa tu nombre completo").max(80),
    customerPhone: z
      .string()
      .trim()
      .refine(phoneRefiner, "Teléfono inválido. Formato: +591XXXXXXXX"),
    customerEmail: z
      .string()
      .trim()
      .max(120)
      .refine(
        (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "Email inválido",
      ),

    deliveryMethod: z.enum(["delivery", "pickup"]),
    deliveryAddress: z.string().trim().max(300),
    deliveryNote: z.string().trim().max(200),
    deliveryZoneId: z.string().optional(),
    // Lat/lng opcionales del cliente. Validamos rangos válidos para evitar
    // basura como "9999, 9999" si alguien manipula el form. Acotamos al
    // hemisferio sur (Bolivia entera está entre lat -22 y -10) para
    // detectar errores groseros — fuera de ese box los descartamos
    // silenciosamente en lugar de fallar.
    deliveryLat: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
      }),
    deliveryLng: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
      }),

    paymentMethod: z.enum(["QR_STATIC", "CASH_ON_DELIVERY"]),
    paymentProofUrl: z
      .string()
      .trim()
      .max(2048)
      // El comprobante DEBE haber sido subido vía nuestro endpoint
      // /api/upload/proof, que lo guarda en private-uploads y devuelve una
      // URL bajo /api/uploads/proof/. Si el cliente envía una URL externa,
      // la rechazamos — sería un vector para que un atacante haga que el
      // merchant vea como "comprobante" una imagen que controla.
      .refine(
        (v) => v === "" || v.startsWith("/api/uploads/proof/"),
        "Comprobante inválido — subilo de nuevo.",
      ),

    customerNotes: z.string().trim().max(500),
    couponCode: z.string().trim().max(40),
  })
  .refine(
    (v) => v.deliveryMethod !== "delivery" || v.deliveryAddress.length >= 5,
    {
      message: "Ingresa la dirección de entrega",
      path: ["deliveryAddress"],
    },
  )
  .refine(
    (v) => v.paymentMethod !== "QR_STATIC" || v.paymentProofUrl.length > 0,
    {
      message: "Tienes que subir el comprobante de pago",
      path: ["paymentProofUrl"],
    },
  );

// ============== Helpers ==============

const normalizePhone = normalizePhoneBO;

function generateTrackingToken(): string {
  // 22 caracteres URL-safe ~= 132 bits de entropía
  return crypto.randomBytes(16).toString("base64url");
}

function buildWhatsAppMessage(opts: {
  storeName: string;
  orderNumber: number;
  trackingUrl: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNote: string;
  deliveryFee: number | null;
  items: { name: string; variantName: string | null; quantity: number; unitPrice: number; notes: string | null }[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentProofUrl: string | null;
  customerNotes: string | null;
}): string {
  const fmt = formatBobAmount;

  const PAYMENT_LABELS: Record<PaymentMethod, string> = {
    QR_STATIC: "QR del banco (comprobante adjunto)",
    QR_DYNAMIC: "QR dinámico",
    CASH_ON_DELIVERY: "Contra entrega",
  };

  const lines = [
    `🧾 *Pedido #${opts.orderNumber}* — ${opts.storeName}`,
    "",
    `*Cliente:* ${opts.customerName}`,
    `*Teléfono:* ${opts.customerPhone}`,
    "",
    "*Tu pedido:*",
  ];

  for (const item of opts.items) {
    const variant = item.variantName ? ` (${item.variantName})` : "";
    lines.push(
      `• ${item.quantity}× ${item.name}${variant} — Bs ${fmt(item.unitPrice * item.quantity)}`,
    );
    if (item.notes) lines.push(`   _${item.notes}_`);
  }

  lines.push("");
  lines.push(`*Subtotal:* Bs ${fmt(opts.subtotal)}`);
  if (opts.discountAmount > 0) lines.push(`*Descuento:* -Bs ${fmt(opts.discountAmount)}`);
  if (opts.deliveryFee != null) lines.push(`*Envío:* Bs ${fmt(opts.deliveryFee)}`);
  lines.push(`*Total:* *Bs ${fmt(opts.total)}*`);
  lines.push("");

  if (opts.deliveryAddress) {
    lines.push("*Dirección:*");
    lines.push(opts.deliveryAddress);
    if (opts.deliveryNote) lines.push(`_${opts.deliveryNote}_`);
    lines.push("");
  }

  lines.push(`*Pago:* ${PAYMENT_LABELS[opts.paymentMethod]}`);
  if (opts.paymentProofUrl) lines.push(`Comprobante: ${opts.paymentProofUrl}`);
  lines.push("");

  if (opts.customerNotes) {
    lines.push(`*Notas:* ${opts.customerNotes}`);
    lines.push("");
  }

  lines.push(`Seguir pedido: ${opts.trackingUrl}`);
  return lines.join("\n");
}

// ============== Action ==============

export async function createOrderAction(
  _prev: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  // 0. Rate limit por IP — 10 pedidos / 10 min protege contra abuse
  const ip = await getClientIp();
  const rl = await rateLimit(`checkout:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
  }

  // 1. Parse + validate
  const raw = {
    storeSlug: String(formData.get("storeSlug") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    deliveryMethod: String(formData.get("deliveryMethod") ?? "delivery"),
    deliveryAddress: String(formData.get("deliveryAddress") ?? ""),
    deliveryNote: String(formData.get("deliveryNote") ?? ""),
    deliveryZoneId: (formData.get("deliveryZoneId") as string) || undefined,
    deliveryLat: (formData.get("deliveryLat") as string) || undefined,
    deliveryLng: (formData.get("deliveryLng") as string) || undefined,
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    paymentProofUrl: String(formData.get("paymentProofUrl") ?? ""),
    customerNotes: String(formData.get("customerNotes") ?? ""),
    couponCode: String(formData.get("couponCode") ?? ""),
  };

  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<CreateOrderState["fieldErrors"]>
      >(parsed.error),
    };
  }
  const data = parsed.data;
  const customerPhone = normalizePhone(data.customerPhone);

  // 2. Resolve store
  const store = await getStoreBySlug(data.storeSlug);
  if (!store) return { error: "Tienda no encontrada" };
  if (store.status === "SUSPENDED" || store.status === "CANCELLED") {
    return { error: "Esta tienda no está aceptando pedidos en este momento." };
  }

  // 3. Validate payment method permitido por la tienda
  if (data.paymentMethod === "QR_STATIC" && !store.acceptsQR) {
    return { fieldErrors: { paymentMethod: "Esta tienda no acepta QR" } };
  }
  if (data.paymentMethod === "CASH_ON_DELIVERY" && !store.acceptsCashOnDelivery) {
    return { fieldErrors: { paymentMethod: "Esta tienda no acepta efectivo" } };
  }

  // 3.b Validate store está abierta ahora. El cliente pudo haber armado el
  // carrito mientras la tienda estaba abierta y demorarse en el checkout;
  // si la tienda cerró entremedio, NO aceptamos el pedido — productos
  // perecederos llegarían descompuestos a la mañana siguiente.
  const now = new Date();
  const storeHours = await db.storeHours.findMany({ where: { storeId: store.id } });
  if (!isStoreOpenNow(storeHours, now)) {
    return {
      error: "La tienda está cerrada ahora. Probá hacer el pedido durante el horario de atención.",
    };
  }

  // 4. Validate delivery method permitido
  if (data.deliveryMethod === "delivery" && !store.deliveryEnabled) {
    return { error: "Esta tienda no hace delivery" };
  }
  if (data.deliveryMethod === "pickup" && !store.pickupEnabled) {
    return { error: "Esta tienda no permite recojo en local" };
  }

  // 5. Resolve cart por guestToken
  const guestToken = await readGuestToken();
  if (!guestToken) {
    return { error: "Carrito vacío. Volvé al menú y agregá productos." };
  }

  const cart = await db.cart.findFirst({
    where: { storeId: store.id, guestToken, expiresAt: { gt: new Date() } },
    include: {
      items: { include: { variant: true } },
    },
  });
  if (!cart || cart.items.length === 0) {
    return { error: "Tu carrito está vacío. Volvé al menú." };
  }

  // 6. Pull product info fresh + recalc todo server-side
  const productIds = Array.from(new Set(cart.items.map((i) => i.productId)));
  const products = await db.product.findMany({
    where: { id: { in: productIds }, storeId: store.id },
    include: {
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      // `variants` necesario para validar stock por variante al crear el
      // pedido (clavo 9mm vs 11mm con stocks distintos).
      variants: { select: { id: true, name: true, manageStock: true, stock: true } },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  type LineComputed = {
    productId: string;
    productName: string;
    productImageUrl: string | null;
    variantId: string | null;
    variantName: string | null;
    quantity: number;
    unitPrice: number; // BOB number, recalculated
    subtotal: number;
    notes: string | null;
  };

  const lines: LineComputed[] = [];
  for (const item of cart.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return {
        error: "Uno de los productos del carrito ya no está disponible. Refrescá el carrito.",
      };
    }
    if (!product.isActive) {
      return { error: `"${product.name}" ya no está disponible.` };
    }
    if (!isProductAvailableNow(product, now)) {
      return {
        error: `"${product.name}" no se vende en este horario. Quitalo del carrito o pedilo en su horario.`,
      };
    }

    let unitPrice = Number(product.basePrice);
    let variantName: string | null = null;
    const variant = item.variantId ? item.variant : null;
    if (item.variantId) {
      if (!variant || !variant.isActive || variant.productId !== product.id) {
        return { error: `Variante de "${product.name}" no disponible.` };
      }
      if (variant.price != null) unitPrice = Number(variant.price);
      variantName = variant.name;
    }

    // Stock check. Si hay variante con manageStock propio, validamos contra
    // ESA variante (ej. clavo 9mm tiene 50 unidades, 11mm tiene 0). Caemos
    // al stock del producto sólo si el ítem no tiene variante o si la
    // variante no maneja stock por sí misma.
    if (variant?.manageStock) {
      if (item.quantity > variant.stock) {
        return {
          error: `Stock insuficiente para "${product.name} · ${variant.name}". Disponible: ${variant.stock}.`,
        };
      }
    } else if (product.manageStock && item.quantity > product.stock) {
      return {
        error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}.`,
      };
    }

    lines.push({
      productId: product.id,
      productName: product.name,
      productImageUrl: product.images[0]?.url ?? null,
      variantId: item.variantId,
      variantName,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice * item.quantity,
      notes: item.notes,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);

  // 7. Delivery fee base (sin cupón aún). Lo calculamos PRIMERO porque el
  // cupón FREE_SHIPPING necesita conocer cuánto vale el envío para poder
  // descontarlo exactamente.
  let deliveryFee: number | null = null;
  let deliveryZoneId: string | null = null;
  if (data.deliveryMethod === "delivery") {
    // Prioridad de resolución de zona:
    //   1. Si el cliente marcó lat/lng en el mapa → encontramos la zona
    //      (círculo) que cubre ese punto. Ignoramos lo que haya elegido
    //      manualmente — la geometría es la fuente de verdad.
    //   2. Si no marcó ubicación pero eligió una zona del select → esa.
    //   3. Si no hay zona ni mapa → fallback a `defaultDeliveryFee`.
    if (data.deliveryLat != null && data.deliveryLng != null) {
      const { findMatchingZone } = await import("@/lib/delivery/geometry");
      const activeZones = await db.deliveryZone.findMany({
        where: { storeId: store.id, isActive: true },
        select: { id: true, polygon: true, fee: true },
      });
      const matched = findMatchingZone(
        activeZones,
        data.deliveryLat,
        data.deliveryLng,
      );
      if (matched) {
        deliveryFee = Number(matched.fee);
        deliveryZoneId = matched.id;
      }
    }
    // Fallback al select manual si la geometría no encontró nada (o el
    // cliente nunca marcó el mapa).
    if (deliveryZoneId === null && data.deliveryZoneId) {
      const zone = await db.deliveryZone.findFirst({
        where: { id: data.deliveryZoneId, storeId: store.id, isActive: true },
      });
      if (zone) {
        deliveryFee = Number(zone.fee);
        deliveryZoneId = zone.id;
      }
    }
    if (deliveryFee === null && store.defaultDeliveryFee != null) {
      deliveryFee = Number(store.defaultDeliveryFee);
    }
  }

  // 8. Coupon. discountAmount agrupa tanto descuentos en producto como
  // FREE_SHIPPING (el ahorro de envío se contabiliza acá para que el
  // historial de la orden refleje el beneficio del cupón, no solo el total).
  let discountAmount = 0;
  let deliveryDiscountAmount = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  if (data.couponCode) {
    const coupon = await db.coupon.findUnique({
      where: { storeId_code: { storeId: store.id, code: data.couponCode.toUpperCase() } },
    });
    if (!coupon || !coupon.isActive) {
      return { fieldErrors: { couponCode: "Cupón inválido" } };
    }
    const now = new Date();
    if (coupon.validFrom > now || coupon.validTo < now) {
      return { fieldErrors: { couponCode: "Cupón fuera de fecha" } };
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { fieldErrors: { couponCode: "Cupón agotado" } };
    }
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      return {
        fieldErrors: {
          couponCode: `Mínimo de Bs ${coupon.minOrderAmount.toFixed(2)} para este cupón`,
        },
      };
    }

    // Sprint 2.7 — usageLimitPerUser: chequear contra CouponUsage por phone.
    if (coupon.usageLimitPerUser) {
      const used = await db.couponUsage.count({
        where: { couponId: coupon.id, customerPhone },
      });
      if (used >= coupon.usageLimitPerUser) {
        return {
          fieldErrors: {
            couponCode: "Ya usaste este cupón el máximo de veces permitido.",
          },
        };
      }
    }

    if (coupon.type === "PERCENTAGE") {
      discountAmount = subtotal * (Number(coupon.value) / 100);
    } else if (coupon.type === "FIXED_AMOUNT") {
      discountAmount = Number(coupon.value);
    } else if (coupon.type === "FREE_SHIPPING") {
      // Aplica solo si hay envío con costo. Sin delivery o con envío gratis
      // por umbral, el cupón no aporta nada.
      deliveryDiscountAmount = deliveryFee ?? 0;
    }
    // maxDiscountAmount es el tope DEL CUPÓN, sin importar de dónde venga el
    // ahorro. Antes lo aplicábamos sólo a `discountAmount`, dejando que un
    // FREE_SHIPPING cubriera el 100% del envío incluso con maxDiscount=10.
    if (coupon.maxDiscountAmount) {
      const maxDiscount = Number(coupon.maxDiscountAmount);
      discountAmount = Math.min(discountAmount, maxDiscount);
      deliveryDiscountAmount = Math.min(deliveryDiscountAmount, maxDiscount);
    }
    discountAmount = Math.min(discountAmount, subtotal); // no permitir total negativo
    couponId = coupon.id;
    couponCode = coupon.code;
  }

  // 9. freeDeliveryAbove se evalúa después del descuento del cupón sobre
  // producto. Si aplica, anula tanto el deliveryFee como cualquier
  // FREE_SHIPPING que ya hubiéramos contabilizado (no doble-descontamos).
  if (
    data.deliveryMethod === "delivery" &&
    store.freeDeliveryAbove &&
    deliveryFee !== null &&
    subtotal - discountAmount >= Number(store.freeDeliveryAbove)
  ) {
    deliveryFee = 0;
    deliveryDiscountAmount = 0;
  }

  // Reflejar el FREE_SHIPPING como descuento real: el envío final se cobra
  // en cero y el ahorro va a discountAmount.
  if (deliveryDiscountAmount > 0 && deliveryFee !== null) {
    deliveryFee = Math.max(0, deliveryFee - deliveryDiscountAmount);
    discountAmount = discountAmount + deliveryDiscountAmount;
  }

  const total =
    Math.round((subtotal - discountAmount + (deliveryFee ?? 0)) * 100) / 100;

  if (total < 0) return { error: "Error en el cálculo del total. Recarga la página." };

  // 9. Decide initial status & paymentStatus
  // QR_STATIC arranca en PENDING_PAYMENT (cliente subió comprobante, owner aún
  // no lo verificó). CASH_ON_DELIVERY arranca en NEW (no hay pago a verificar
  // hasta la entrega). Esto alinea el timeline del tracking page con la
  // realidad — el step "Pago pendiente" es el activo, no un paso futuro fijo.
  const orderStatus: OrderStatus =
    data.paymentMethod === "QR_STATIC" ? "PENDING_PAYMENT" : "NEW";
  const paymentStatus: PaymentStatus =
    data.paymentMethod === "QR_STATIC" ? "AWAITING_VERIFICATION" : "PENDING";

  // 10. Decidir si el stock debe aplicarse al crear: SÍ para ambos métodos.
  //
  // Antes QR esperaba a la verificación del pago. Eso abría una race: dos
  // pedidos QR concurrentes por la última unidad ambos pasaban el chequeo
  // de stock externo a la TX (líneas 332-346) y se creaban; al verificar,
  // el segundo fallaba con error genérico cuando el cliente ya había pagado.
  //
  // Aplicando el stock al crear (también para QR), el `updateMany ... stock
  // >= quantity` de líneas 631+ se vuelve la fuente de verdad atómica: si
  // dos clientes pelean la última unidad, el segundo ve "stock insuficiente"
  // ANTES de subir comprobante en lugar de quedar colgado.
  //
  // El trade-off de fake comprobantes (cliente sube screenshot inválido →
  // stock queda reservado hasta que owner rechaza) es manejable: el owner
  // tiene un botón "Rechazar pago" que invoca `revertOrderImpact` y restituye
  // el stock instantáneamente — mismo costo operativo que cancelar un CoD.
  const applyStockNow = true;

  // 11. Transacción atómica.
  // El orderNumber se obtiene con upsert+increment sobre StoreOrderCounter,
  // que toma row lock en Postgres y serializa lambdas concurrentes — elimina
  // la race del patrón `aggregate _max + 1` anterior.
  const trackingToken = generateTrackingToken();

  let createdOrder: { id: string; orderNumber: number; trackingToken: string } | null = null;

  try {
    createdOrder = await db.$transaction(async (tx) => {
      // Counter atómico de orderNumber por tienda.
      const counter = await tx.storeOrderCounter.upsert({
        where: { storeId: store.id },
        create: { storeId: store.id, current: 1 },
        update: { current: { increment: 1 } },
        select: { current: true },
      });
      const orderNumber = counter.current;

      // Customer upsert. Counters sólo se incrementan si el stock también se
      // aplica ahora — de lo contrario quedan para verifyPaymentAction.
      const customer = await tx.customer.upsert({
        where: { storeId_phone: { storeId: store.id, phone: customerPhone } },
        create: {
          storeId: store.id,
          fullName: data.customerName,
          phone: customerPhone,
          email: data.customerEmail || null,
          lastAddressText: data.deliveryAddress || null,
          lastNote: data.deliveryNote || null,
          ordersCount: applyStockNow ? 1 : 0,
          totalSpent: applyStockNow ? new Prisma.Decimal(total) : new Prisma.Decimal(0),
          lastOrderAt: applyStockNow ? new Date() : null,
        },
        update: {
          fullName: data.customerName,
          email: data.customerEmail || undefined,
          lastAddressText: data.deliveryAddress || undefined,
          lastNote: data.deliveryNote || undefined,
          ...(applyStockNow
            ? {
                ordersCount: { increment: 1 },
                totalSpent: { increment: new Prisma.Decimal(total) },
                lastOrderAt: new Date(),
              }
            : {}),
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          trackingToken,
          storeId: store.id,
          customerId: customer.id,
          customerName: data.customerName,
          customerPhone,
          customerEmail: data.customerEmail || null,
          deliveryAddress:
            data.deliveryMethod === "delivery" ? data.deliveryAddress : "Recojo en local",
          deliveryNote: data.deliveryNote || null,
          deliveryZoneId,
          // Coordenadas solo se guardan si vinieron Y la entrega es a domicilio.
          // En pickup el cliente va al local, no aporta la ubicación del cliente.
          deliveryLat:
            data.deliveryMethod === "delivery" ? data.deliveryLat : null,
          deliveryLng:
            data.deliveryMethod === "delivery" ? data.deliveryLng : null,
          subtotal: new Prisma.Decimal(subtotal),
          discountAmount: new Prisma.Decimal(discountAmount),
          deliveryFee: deliveryFee != null ? new Prisma.Decimal(deliveryFee) : null,
          total: new Prisma.Decimal(total),
          couponId,
          couponCode,
          status: orderStatus,
          paymentMethod: data.paymentMethod as PaymentMethod,
          paymentStatus,
          paymentProofUrl: data.paymentProofUrl || null,
          customerNotes: data.customerNotes || null,
          stockApplied: applyStockNow,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              productImageUrl: l.productImageUrl,
              variantId: l.variantId,
              variantName: l.variantName,
              quantity: l.quantity,
              unitPrice: new Prisma.Decimal(l.unitPrice),
              subtotal: new Prisma.Decimal(l.subtotal),
              notes: l.notes,
            })),
          },
          events: {
            create: {
              type: "ORDER_CREATED",
              description: `Pedido #${orderNumber} creado`,
              metadata: { paymentMethod: data.paymentMethod },
            },
          },
        },
        select: { id: true, orderNumber: true, trackingToken: true },
      });

      if (applyStockNow) {
        for (const l of lines) {
          const p = productMap.get(l.productId)!;
          // Si la línea tiene variante con manageStock propio, decrementamos
          // ahí. Sino caemos al stock del producto. updateMany con guard
          // `stock >= quantity` evita negativos en carreras concurrentes.
          if (l.variantId) {
            const v = p.variants.find((x) => x.id === l.variantId);
            if (v?.manageStock) {
              const r = await tx.productVariant.updateMany({
                where: { id: l.variantId, stock: { gte: l.quantity } },
                data: { stock: { decrement: l.quantity } },
              });
              if (r.count === 0) {
                throw new Error(
                  `Stock insuficiente para "${p.name} · ${v.name}" — alguien lo compró mientras procesabas el pedido.`,
                );
              }
              continue;
            }
          }
          if (p.manageStock) {
            const r = await tx.product.updateMany({
              where: { id: l.productId, stock: { gte: l.quantity } },
              data: { stock: { decrement: l.quantity } },
            });
            if (r.count === 0) {
              throw new Error(
                `Stock insuficiente para "${p.name}" — alguien lo compró mientras procesabas el pedido.`,
              );
            }
          }
        }
      }

      // Cupón: incrementar contador global + registrar uso por usuario.
      //
      // El check de `usageLimit` fuera de la tx puede caer en una race:
      // dos pedidos concurrentes leen `usedCount=4`, ambos pasan, ambos
      // incrementan a 5 y 6 — superando un cupón con limit=5. Solución:
      // increment condicional vía SQL con `usedCount < usageLimit` evaluado
      // por Postgres bajo el row lock del UPDATE.
      if (couponId) {
        const updated = await tx.$executeRaw`
          UPDATE "Coupon"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${couponId}
            AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
        `;
        if (Number(updated) === 0) {
          // updateMany devuelve 0 si el cupón se agotó entre el check inicial
          // y este punto. Abortamos toda la transacción — el pedido no se crea.
          throw new Error(
            "Cupón agotado — alguien lo usó mientras procesabas el pedido. Probá sin cupón.",
          );
        }
        // usageLimitPerUser bajo el mismo row lock: el COUNT corre después
        // del UPDATE anterior, así que ve un snapshot serializado por cupón.
        const c = await tx.coupon.findUnique({
          where: { id: couponId },
          select: { usageLimitPerUser: true },
        });
        if (c?.usageLimitPerUser) {
          const used = await tx.couponUsage.count({
            where: { couponId, customerPhone },
          });
          if (used >= c.usageLimitPerUser) {
            throw new Error(
              "Ya usaste este cupón el máximo de veces permitido.",
            );
          }
        }
        await tx.couponUsage.create({
          data: { couponId, orderId: order.id, customerPhone },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.includes("trackingToken")) {
        // Colisión astronómicamente rara — 132 bits de entropía.
        return { error: "Error generando el pedido. Probá de nuevo." };
      }
    }
    // Carreras de cupón (usageLimit o usageLimitPerUser detectadas dentro de
    // la transacción) — devolver feedback al campo del cupón, no error genérico.
    if (err instanceof Error) {
      if (err.message.startsWith("Cupón agotado")) {
        return { fieldErrors: { couponCode: err.message } };
      }
      if (err.message.startsWith("Ya usaste este cupón")) {
        return { fieldErrors: { couponCode: err.message } };
      }
    }
    throw err;
  }

  if (!createdOrder) {
    return { error: "No pudimos crear el pedido. Probá de nuevo." };
  }

  await audit({
    action: "order.created",
    target: createdOrder.id,
    metadata: {
      orderNumber: createdOrder.orderNumber,
      storeId: store.id,
      total,
      paymentMethod: data.paymentMethod,
    },
  });

  // 11. WhatsApp message
  const trackingUrl = `${appUrl()}/${store.slug}/orden/${createdOrder.trackingToken}`;
  const message = buildWhatsAppMessage({
    storeName: store.name,
    orderNumber: createdOrder.orderNumber,
    trackingUrl,
    customerName: data.customerName,
    customerPhone,
    deliveryAddress:
      data.deliveryMethod === "delivery" ? data.deliveryAddress : "Recojo en local",
    deliveryNote: data.deliveryNote,
    deliveryFee,
    items: lines.map((l) => ({
      name: l.productName,
      variantName: l.variantName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      notes: l.notes,
    })),
    subtotal,
    discountAmount,
    total,
    paymentMethod: data.paymentMethod as PaymentMethod,
    paymentProofUrl: data.paymentProofUrl || null,
    customerNotes: data.customerNotes || null,
  });
  const whatsappUrl = buildWhatsAppUrl(store.whatsappPhone, message);

  // Guardar el mensaje en la order para auditoría. Si esto falla, el pedido
  // ya está creado correctamente (la transacción de arriba commiteó) — solo
  // se pierde el snapshot del WhatsApp. Logueamos para detectarlo.
  await db.order
    .update({
      where: { id: createdOrder.id },
      data: { whatsappMessage: message },
    })
    .catch((err) =>
      console.error("[orders] whatsappMessage snapshot failed", err),
    );

  // 11.5 Notificar al owner por email (fire-and-forget)
  // Buscamos el primer STORE_OWNER de la tienda con email setado.
  const owner = await db.user.findFirst({
    where: { storeId: store.id, role: Role.STORE_OWNER, email: { not: null } },
    select: { email: true, fullName: true },
    orderBy: { createdAt: "asc" },
  });
  if (owner?.email) {
    sendEmailBackground(
      orderCreatedOwnerEmail({
        to: owner.email,
        ownerName: owner.fullName ?? store.name,
        storeSlug: store.slug,
        orderNumber: createdOrder.orderNumber,
        customerName: data.customerName,
        customerPhone,
        total,
        paymentMethod: data.paymentMethod as PaymentMethod,
        awaitingVerification: paymentStatus === "AWAITING_VERIFICATION",
        itemsCount: lines.length,
      }),
    );
  }

  // 12. Invalidaciones
  revalidatePath(`/${store.slug}`);
  revalidatePath(`/${store.slug}/orden/${createdOrder.trackingToken}`);
  revalidatePath("/dashboard/pedidos");
  revalidateTag(`store:${store.slug}`);

  return {
    ok: {
      trackingToken: createdOrder.trackingToken,
      orderNumber: createdOrder.orderNumber,
      whatsappUrl,
    },
  };
}

// ============== Marcar WhatsApp como abierto ==============
// Llamado desde el cliente cuando abre el link de WA. Defensa en profundidad:
//   - El trackingToken (132 bits) ya es difícil de adivinar.
//   - Exigimos también el `storeSlug` que viene del path, para que un atacante
//     que obtenga un token tenga que conocer también la tienda.
//   - La query es idempotente: sólo escribe si `whatsappOpenedAt` está NULL,
//     evitando que se "refresque" la métrica para sesgar conversiones.
//   - Rate limit por IP para limitar fuzzing masivo.

export async function markWhatsAppOpened(
  storeSlug: string,
  trackingToken: string,
): Promise<void> {
  if (!storeSlug || !trackingToken) return;

  const ip = await getClientIp();
  const rl = await rateLimit(`mark-wa:${ip}`, 30, 60 * 1000);
  if (!rl.success) return;

  try {
    await db.order.updateMany({
      where: {
        trackingToken,
        store: { slug: storeSlug },
        whatsappOpenedAt: null,
      },
      data: { whatsappOpenedAt: new Date() },
    });
  } catch (err) {
    console.error("[markWhatsAppOpened] failed:", err);
  }
}
