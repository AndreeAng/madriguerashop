"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OrderStatus, PaymentStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds, requireStoreOwnerIds } from "@/lib/auth/session";
import { getStoreSlugById } from "@/lib/tenant/resolve";
import { STATUS_FLOW, STATUS_LABELS } from "@/lib/orders/status";
import { sendEmailBackground } from "@/lib/email/send";
import {
  paymentRejectedCustomerEmail,
  paymentVerifiedCustomerEmail,
} from "@/lib/email/templates/order";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import type { ActionState } from "./store-settings";

/**
 * Helpers de stock + Customer counters.
 *
 * Diseño: cada orden tiene un flag `stockApplied` que indica si su impacto
 * sobre inventario y métricas del cliente ya fue aplicado. CoD lo aplica al
 * crear; QR lo aplica al verificar. Cualquier cancelación lo revierte.
 *
 * Se ejecutan SIEMPRE dentro de una transacción (tx) para que el flag y los
 * mutaciones queden atómicos.
 */
type TxClient = Prisma.TransactionClient;

async function applyOrderImpact(tx: TxClient, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      storeId: true,
      customerId: true,
      total: true,
      stockApplied: true,
      items: {
        select: {
          productId: true,
          variantId: true,
          productName: true,
          variantName: true,
          quantity: true,
          product: { select: { manageStock: true } },
          variant: { select: { manageStock: true } },
        },
      },
    },
  });
  if (!order || order.stockApplied) return;

  for (const item of order.items) {
    // Prioridad: stock de variante > stock de producto. Cada decremento
    // usa `updateMany where stock >= quantity` para abortar si una
    // verificación concurrente ya consumió el inventario.
    if (item.variantId && item.variant?.manageStock) {
      const updated = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw new Error(
          `Stock insuficiente al verificar — "${item.productName} · ${item.variantName ?? ""}" cambió entre creación y verificación.`,
        );
      }
      continue;
    }
    if (item.product.manageStock) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw new Error(
          `Stock insuficiente al verificar — "${item.productName}" cambió entre creación y verificación.`,
        );
      }
    }
  }

  if (order.customerId) {
    await tx.customer.update({
      where: { id: order.customerId },
      data: {
        ordersCount: { increment: 1 },
        totalSpent: { increment: order.total },
        lastOrderAt: new Date(),
      },
    });
  }

  await tx.order.update({
    where: { id: order.id },
    data: { stockApplied: true },
  });
}

async function revertOrderImpact(tx: TxClient, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      couponId: true,
      total: true,
      stockApplied: true,
      items: {
        select: {
          productId: true,
          variantId: true,
          quantity: true,
          product: { select: { manageStock: true } },
          variant: { select: { manageStock: true } },
        },
      },
    },
  });
  if (!order) return;

  // Stock + customer counters: sólo si fueron aplicados previamente. El flag
  // `stockApplied` es la fuente de verdad: en QR el impact se aplica al
  // verificar, no al crear, así que un cancel previo a la verificación
  // no debe restituir stock que nunca se decrementó.
  if (order.stockApplied) {
    for (const item of order.items) {
      // Restitución refleja el decremento: variante si la tenía, sino producto.
      if (item.variantId && item.variant?.manageStock) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else if (item.product.manageStock) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    if (order.customerId) {
      // ordersCount y totalSpent no pueden quedar negativos. `max(..., 0)` no
      // existe en increments de Prisma, así que leemos y calculamos.
      const c = await tx.customer.findUnique({
        where: { id: order.customerId },
        select: { ordersCount: true, totalSpent: true },
      });
      if (c) {
        const nextTotalSpent = new Prisma.Decimal(c.totalSpent).minus(order.total);
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            ordersCount: Math.max(0, c.ordersCount - 1),
            totalSpent: nextTotalSpent.isNegative() ? new Prisma.Decimal(0) : nextTotalSpent,
          },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: { stockApplied: false },
    });
  }

  // Cupón: el uso se registra al CREAR el pedido, independientemente del
  // método de pago — así que el revert también debe correr siempre, no
  // sólo si stockApplied. La deleteMany es idempotente (vacío si ya
  // se revirtió antes) y la guard `usedCount > 0` evita ir a negativo.
  if (order.couponId) {
    const deletedUsage = await tx.couponUsage.deleteMany({
      where: { orderId: order.id, couponId: order.couponId },
    });
    if (deletedUsage.count > 0) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
  }
}

// ============== Cambio de estado ==============

const TIMESTAMP_FIELDS: Partial<
  Record<OrderStatus, "confirmedAt" | "preparingAt" | "inDeliveryAt" | "deliveredAt" | "cancelledAt">
> = {
  CONFIRMED: "confirmedAt",
  PREPARING: "preparingAt",
  IN_DELIVERY: "inDeliveryAt",
  DELIVERED: "deliveredAt",
  CANCELLED: "cancelledAt",
};

const changeStatusSchema = z.object({
  orderId: z.string().min(1),
  toStatus: z.nativeEnum(OrderStatus),
  reason: z.string().trim().max(200).optional(),
});

export async function changeOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { storeId, userId, role } = await requireStoreOwnerIds();

  const parsed = changeStatusSchema.safeParse({
    orderId: formData.get("orderId"),
    toStatus: formData.get("toStatus"),
    reason: (formData.get("reason") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: "Datos inválidos" };
  }
  const { orderId, toStatus, reason } = parsed.data;

  // CASHIER bloqueado de CANCELAR: es operativo, no decisorio. La cancelación
  // suele implicar reembolso/comunicación con el cliente — decisión del owner.
  if (toStatus === "CANCELLED" && role === Role.CASHIER) {
    return { error: "Sólo el dueño puede cancelar pedidos." };
  }

  const order = await db.order.findFirst({
    where: { id: orderId, storeId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      trackingToken: true,
      storeId: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });
  if (!order) return { error: "Pedido no encontrado" };

  // Validar transición permitida
  const allowed = STATUS_FLOW[order.status];
  if (!allowed.includes(toStatus)) {
    return {
      error: `No puedes pasar de "${STATUS_LABELS[order.status]}" a "${STATUS_LABELS[toStatus]}".`,
    };
  }

  // Si cancela, exigir razón
  if (toStatus === "CANCELLED" && (!reason || reason.length < 3)) {
    return { error: "Tienes que indicar el motivo de la cancelación." };
  }

  const tsField = TIMESTAMP_FIELDS[toStatus];
  const now = new Date();

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });

  // CoD que se marca DELIVERED implica que el cliente pagó en efectivo al
  // recibir el pedido — el pago queda VERIFIED. Sin esto el pedido se
  // entregaba pero quedaba con paymentStatus=PENDING, lo que ensucia las
  // métricas de revenue y confunde al admin viendo "pagos pendientes".
  const autoVerifyPayment =
    toStatus === "DELIVERED" &&
    order.paymentMethod === "CASH_ON_DELIVERY" &&
    order.paymentStatus === "PENDING";

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: toStatus,
        ...(tsField ? { [tsField]: now } : {}),
        ...(toStatus === "CANCELLED" ? { cancelReason: reason ?? null } : {}),
        ...(autoVerifyPayment
          ? {
              paymentStatus: PaymentStatus.VERIFIED,
              paymentVerifiedAt: now,
              paymentVerifiedById: userId,
            }
          : {}),
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: `STATUS_${toStatus}`,
        description: `Estado cambiado a "${STATUS_LABELS[toStatus]}"${reason ? ` — ${reason}` : ""}`,
        byUserId: userId,
        byUserName: actor?.fullName ?? actor?.username ?? null,
      },
    });

    if (autoVerifyPayment) {
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "PAYMENT_VERIFIED",
          description: "Pago en efectivo recibido en entrega",
          byUserId: userId,
          byUserName: actor?.fullName ?? actor?.username ?? null,
        },
      });
    }

    // Si se cancela, restituir stock + Customer counters + cupón (el helper
    // es idempotente por dentro: cada subsistema chequea su propio flag).
    if (toStatus === "CANCELLED") {
      await revertOrderImpact(tx, orderId);
    }
  });

  await audit({
    action: "order.status_changed",
    actorId: userId,
    target: orderId,
    metadata: {
      orderNumber: order.orderNumber,
      from: order.status,
      to: toStatus,
      reason: reason ?? null,
    },
  });

  const storeSlug = await getStoreSlugById(storeId);
  if (storeSlug) {
    revalidatePath(`/${storeSlug}/orden/${order.trackingToken}`);
  }
  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${orderId}`);
  return { ok: true };
}

// ============== Verificar / rechazar pago ==============

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
});

export async function verifyPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Verificar pagos es decisión del owner (impacta inventario y métricas).
  const { storeId, userId } = await requireOwnerOnlyIds();
  const parsed = verifyPaymentSchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) return { error: "Datos inválidos" };

  const order = await db.order.findFirst({
    where: { id: parsed.data.orderId, storeId },
    select: {
      id: true,
      paymentStatus: true,
      status: true,
      trackingToken: true,
      orderNumber: true,
      customerEmail: true,
      total: true,
      store: { select: { name: true, slug: true } },
    },
  });
  if (!order) return { error: "Pedido no encontrado" };

  if (
    order.paymentStatus !== "AWAITING_VERIFICATION" &&
    order.paymentStatus !== "PENDING"
  ) {
    return { error: "Este pago ya fue procesado." };
  }
  // No verificar pagos sobre pedidos ya cancelados — sería un estado
  // inconsistente (CANCELLED + paymentStatus=VERIFIED).
  if (order.status === "CANCELLED") {
    return { error: "Este pedido está cancelado; no se puede verificar el pago." };
  }

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });

  try {
    await db.$transaction(async (tx) => {
      // Re-validar paymentStatus DENTRO de la transacción con un update
      // condicional: si otro request concurrente ya lo verificó, este
      // updateMany devuelve count=0 y abortamos. Sin esto, dos clicks
      // rápidos del owner pasaban el guard arriba (que está fuera de la
      // tx) y ambos ejecutaban `applyOrderImpact` → stock decrementado
      // dos veces, `Customer.ordersCount/totalSpent` incrementados dos
      // veces. El check de `stockApplied` dentro de `applyOrderImpact`
      // solo cubre el caso "ya fue verificado en otra sesión", no la
      // race de dos transacciones simultáneas leyendo el mismo state.
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: { in: ["AWAITING_VERIFICATION", "PENDING"] },
        },
        data: {
          paymentStatus: "VERIFIED",
          paymentVerifiedAt: new Date(),
          paymentVerifiedById: userId,
          // Si estaba esperando pago (QR_STATIC) lo movemos a NEW: ya entró
          // formalmente al flujo de cocina. Si ya estaba NEW (cash que pagó
          // anticipado), lo confirmamos directo.
          ...(order.status === "PENDING_PAYMENT"
            ? { status: "NEW" }
            : order.status === "NEW"
              ? { status: "CONFIRMED", confirmedAt: new Date() }
              : {}),
        },
      });
      if (claimed.count === 0) {
        throw new Error("__already_verified__");
      }
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "PAYMENT_VERIFIED",
          description: "Pago verificado",
          byUserId: userId,
          byUserName: actor?.fullName ?? actor?.username ?? null,
        },
      });

      // Aplicar stock + Customer counters si aún no fueron aplicados (típico
      // en pedidos QR que diferían el impacto hasta verificación).
      await applyOrderImpact(tx, order.id);
    });
  } catch (err) {
    if (err instanceof Error && err.message === "__already_verified__") {
      return { error: "Este pago ya fue procesado por otra sesión." };
    }
    throw err;
  }

  await audit({
    action: "order.payment.verified",
    actorId: userId,
    target: order.id,
    metadata: {
      orderNumber: order.orderNumber,
      total: Number(order.total),
    },
  });

  // Email al cliente — fire-and-forget
  if (order.customerEmail) {
    sendEmailBackground(
      paymentVerifiedCustomerEmail({
        to: order.customerEmail,
        storeName: order.store.name,
        storeSlug: order.store.slug,
        orderNumber: order.orderNumber,
        trackingToken: order.trackingToken,
        total: Number(order.total),
      }),
    );
  }

  revalidatePath(`/${order.store.slug}/orden/${order.trackingToken}`);
  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${order.id}`);
  return { ok: true };
}

const rejectPaymentSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3, "Indicá el motivo del rechazo").max(200),
});

export async function rejectPaymentAction(
  _prev: ActionState<"reason">,
  formData: FormData,
): Promise<ActionState<"reason">> {
  // Rechazar pagos es decisión del owner (afecta percepción del cliente y
  // potencialmente requiere comunicación adicional).
  const { storeId, userId } = await requireOwnerOnlyIds();
  const parsed = rejectPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<"reason">(parsed.error) };
  }

  const order = await db.order.findFirst({
    where: { id: parsed.data.orderId, storeId },
    select: {
      id: true,
      paymentStatus: true,
      status: true,
      trackingToken: true,
      orderNumber: true,
      customerEmail: true,
      store: { select: { name: true, slug: true, whatsappPhone: true } },
    },
  });
  if (!order) return { error: "Pedido no encontrado" };

  // No se puede rechazar un pago ya VERIFICADO o ya REJECTED. Para "deshacer"
  // un verify se debe cancelar el pedido entero, que dispara el revert del
  // stock/customer/cupón vía revertOrderImpact.
  if (
    order.paymentStatus !== "AWAITING_VERIFICATION" &&
    order.paymentStatus !== "PENDING"
  ) {
    return { error: "Este pago ya fue procesado." };
  }

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });

  // Decisión local: ¿el rechazo cancela el pedido? Cancelamos siempre que el
  // status sea pre-entrega. IN_DELIVERY / DELIVERED requieren refund, no reject.
  const willCancel =
    order.status === "PENDING_PAYMENT" ||
    order.status === "NEW" ||
    order.status === "CONFIRMED" ||
    order.status === "PREPARING";

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.REJECTED,
        paymentRejectedReason: parsed.data.reason,
        ...(willCancel
          ? {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelReason: `Pago rechazado: ${parsed.data.reason}`,
            }
          : {}),
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_REJECTED",
        description: `Pago rechazado: ${parsed.data.reason}`,
        byUserId: userId,
        byUserName: actor?.fullName ?? actor?.username ?? null,
      },
    });
    // Cuando el rechazo cancela el pedido, emitimos `STATUS_CANCELLED`
    // explícito para que el timeline de tracking del cliente y el historial
    // del dashboard muestren "Pedido cancelado" como paso final además del
    // "Pago rechazado". Sin esto, `changeOrderStatusAction` era el único
    // emisor y el cliente quedaba sin confirmación visual de la cancelación.
    if (willCancel) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "STATUS_CANCELLED",
          description: "Pedido cancelado",
          byUserId: userId,
          byUserName: actor?.fullName ?? actor?.username ?? null,
          metadata: { fromStatus: order.status, reason: "payment_rejected" },
        },
      });
    }

    // Si el stock había sido aplicado (raro en este flujo, pero posible si
    // el pago se verificó y luego se rechazó manualmente), restituir.
    await revertOrderImpact(tx, order.id);
  });

  await audit({
    action: "order.payment.rejected",
    actorId: userId,
    target: order.id,
    metadata: { reason: parsed.data.reason },
  });

  // Email al cliente — fire-and-forget
  if (order.customerEmail) {
    sendEmailBackground(
      paymentRejectedCustomerEmail({
        to: order.customerEmail,
        storeName: order.store.name,
        storeSlug: order.store.slug,
        orderNumber: order.orderNumber,
        trackingToken: order.trackingToken,
        reason: parsed.data.reason,
        storeWhatsapp: order.store.whatsappPhone,
      }),
    );
  }

  revalidatePath(`/${order.store.slug}/orden/${order.trackingToken}`);
  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${order.id}`);
  return { ok: true };
}

// ============== Cancelación por el cliente (vía tracking token) ==============
//
// El SRS exige permitir que el cliente cancele su propio pedido desde la
// página pública de tracking. NO hay auth — la autorización es por
// `trackingToken` (132 bits de entropía). El cliente solo puede cancelar
// si el pedido aún no entró a preparación: una vez el local empezó a
// preparar, la cancelación debe ser coordinada por WhatsApp.

const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.NEW,
];

const customerCancelSchema = z.object({
  token: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  reason: z.string().trim().min(3).max(200),
});

export async function customerCancelOrderAction(
  _prev: ActionState<"reason">,
  formData: FormData,
): Promise<ActionState<"reason">> {
  const parsed = customerCancelSchema.safeParse({
    token: formData.get("token"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<"reason">(parsed.error) };
  }

  const order = await db.order.findUnique({
    where: { trackingToken: parsed.data.token },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      storeId: true,
      trackingToken: true,
      store: { select: { slug: true } },
    },
  });
  if (!order) return { error: "Pedido no encontrado." };

  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
    return {
      error:
        "Este pedido ya está en preparación. Para cancelarlo, escríbenos por WhatsApp.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      // Claim atómico: si otro proceso cambió el status entre el read y el
      // update, no cancelamos. `updateMany` devuelve count=0 y abortamos.
      const claim = await tx.order.updateMany({
        where: { id: order.id, status: { in: CUSTOMER_CANCELLABLE_STATUSES } },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: `Cancelado por el cliente: ${parsed.data.reason}`,
        },
      });
      if (claim.count === 0) throw new Error("__already_processed__");

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "STATUS_CANCELLED",
          description: `Cancelado por el cliente — ${parsed.data.reason}`,
          // sin byUserId/byUserName porque el cliente no tiene cuenta.
          metadata: { source: "customer", reason: parsed.data.reason },
        },
      });
      await revertOrderImpact(tx, order.id);
    });
  } catch (err) {
    if (err instanceof Error && err.message === "__already_processed__") {
      return { error: "Este pedido ya cambió de estado. Refrescá la página." };
    }
    throw err;
  }

  await audit({
    action: "order.status_changed",
    storeId: order.storeId,
    target: order.id,
    metadata: {
      orderNumber: order.orderNumber,
      from: order.status,
      to: "CANCELLED",
      source: "customer",
      reason: parsed.data.reason,
    },
  });

  revalidatePath(`/${order.store.slug}/orden/${order.trackingToken}`);
  revalidatePath("/dashboard/pedidos");
  return { ok: true };
}

