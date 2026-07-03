"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OrderStatus, PaymentStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwnerOnlyIds, requireStoreOwnerIds } from "@/lib/auth/session";
import { getStoreSlugById } from "@/lib/tenant/resolve";
import { STATUS_FLOW, STATUS_LABELS } from "@/lib/orders/status";
import { sendEmailBackground } from "@/lib/email/send";
import {
  paymentRejectedCustomerEmail,
  paymentVerifiedCustomerEmail,
  orderStatusChangedCustomerEmail,
} from "@/lib/email/templates/order";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { INVALID_INPUT_ERROR, type ActionState } from "@/lib/validation/actionState";
import {
  rateLimit,
  rateLimitErrorMessage,
  getClientIp,
} from "@/lib/security/rateLimit";

// Impacto de inventario/contadores (apply al crear/verificar, revert al
// cancelar/rechazar). Extraído a `lib/orders/impact.ts` — módulo plano,
// testeable en integración y fuera de la superficie de server actions.
import { applyOrderImpact, revertOrderImpact } from "@/lib/orders/impact";

// ============== Cambio de estado ==============

const TIMESTAMP_FIELDS: Partial<
  Record<OrderStatus, "newAt" | "confirmedAt" | "preparingAt" | "inDeliveryAt" | "deliveredAt" | "cancelledAt">
> = {
  NEW: "newAt",
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
    return { error: INVALID_INPUT_ERROR };
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
      deliveryAddress: true,
      customerEmail: true,
      store: { select: { name: true, slug: true, vertical: true } },
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

  // PREPARING → DELIVERED solo es legítimo para pickup (cliente retira en
  // local, no hay step IN_DELIVERY). Para delivery exigimos pasar por
  // IN_DELIVERY primero — saltar el paso oculta la asignación al courier
  // y rompe el TRACKING_STEPS del cliente. Inferimos el método del pedido
  // desde `deliveryAddress`: si tiene dirección no vacía → delivery.
  const isDeliveryOrder = order.deliveryAddress.trim().length > 0;
  if (
    order.status === "PREPARING" &&
    toStatus === "DELIVERED" &&
    isDeliveryOrder
  ) {
    return {
      error: "Marca primero el pedido como 'En camino' antes de entregarlo.",
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
  //
  // Solo el OWNER puede registrar el cobro. El cashier puede cambiar el
  // status del pedido pero no decidir que el efectivo fue recibido — esa
  // es responsabilidad de quien controla la caja. Sin este guard, un
  // cashier que marca DELIVERED en un CoD verifica el pago saltándose
  // el `requireOwnerOnlyIds` que protege `verifyPaymentAction`.
  const autoVerifyPayment =
    toStatus === "DELIVERED" &&
    order.paymentMethod === "CASH_ON_DELIVERY" &&
    order.paymentStatus === "PENDING" &&
    role !== Role.CASHIER;

  try {
    await db.$transaction(async (tx) => {
      // CLAIM ATÓMICO: el `updateMany` con `status: order.status` actúa
      // como test-and-set. Si entre el `findFirst` (fuera de tx) y este
      // update otro cashier/owner cambió el estado, `count === 0` y
      // abortamos sin tocar nada — evita doble-DELIVERED, doble auto-verify
      // de pago CoD, y overwrite de un CANCELLED por un DELIVERED tardío.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
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
      if (claimed.count === 0) {
        throw new Error("__status_changed__");
      }

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
  } catch (err) {
    if (err instanceof Error && err.message === "__status_changed__") {
      return { error: "Otro usuario ya cambió el estado de este pedido. Recarga la página." };
    }
    throw err;
  }

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

  // Email al cliente en transiciones relevantes (fire-and-forget)
  const STATUS_WITH_EMAIL = ["CONFIRMED", "IN_DELIVERY", "DELIVERED", "CANCELLED"] as const;
  type EmailableStatus = typeof STATUS_WITH_EMAIL[number];
  if (
    order.customerEmail &&
    (STATUS_WITH_EMAIL as readonly string[]).includes(toStatus)
  ) {
    sendEmailBackground(
      orderStatusChangedCustomerEmail({
        to: order.customerEmail,
        storeName: order.store.name,
        storeSlug: order.store.slug,
        orderNumber: order.orderNumber,
        trackingToken: order.trackingToken,
        newStatus: toStatus as EmailableStatus,
        cancelReason: toStatus === "CANCELLED" ? (reason ?? null) : null,
        vertical: order.store.vertical,
      }),
    );
  }

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
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

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
      store: { select: { name: true, slug: true, vertical: true } },
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
          // Guard atómico contra cancelación concurrente: si entre el
          // findFirst (fuera de tx) y este updateMany, otro flujo cancela
          // el pedido (changeOrderStatusAction o adminToggleStoreStatus),
          // este where rechaza el claim. Sin esto un order CANCELLED
          // quedaba con paymentStatus:VERIFIED — estado inconsistente.
          status: { not: "CANCELLED" },
        },
        data: {
          paymentStatus: "VERIFIED",
          paymentVerifiedAt: new Date(),
          paymentVerifiedById: userId,
          // Si estaba esperando pago (QR_STATIC) lo movemos a NEW: ya entró
          // formalmente al flujo de cocina. Si ya estaba NEW (cash que pagó
          // anticipado), lo confirmamos directo.
          ...(order.status === "PENDING_PAYMENT"
            ? { status: "NEW", newAt: new Date() }
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
      // Si la verificación implicó NEW→CONFIRMED, también emitimos el
      // STATUS_CONFIRMED event para que el timeline del cliente y los
      // filtros de auditoría por "status_changed" no pierdan el evento.
      // Sin esto, confirmedAt quedaba seteado pero no había trail visible.
      if (order.status === "NEW") {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "STATUS_CONFIRMED",
            description: "Pedido confirmado por verificación de pago",
            byUserId: userId,
            byUserName: actor?.fullName ?? actor?.username ?? null,
          },
        });
      }

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
        vertical: order.store.vertical,
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
      store: { select: { name: true, slug: true, whatsappPhone: true, vertical: true } },
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
  // Un pedido que ya salió (IN_DELIVERY) o se entregó no admite reject:
  // el `revertOrderImpact` de abajo restituiría stock de mercadería que
  // está físicamente en la calle, y el pedido quedaría activo con pago
  // REJECTED — estado incoherente. Para estos casos el flujo correcto es
  // el reembolso (`markOrderRefundedAction`) o la cancelación del pedido.
  if (order.status === "IN_DELIVERY" || order.status === "DELIVERED") {
    return {
      error:
        "Este pedido ya salió a entrega. Usa 'Marcar reembolsado' o cancela el pedido para registrar la devolución.",
    };
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

  try {
    await db.$transaction(async (tx) => {
      // CLAIM ATÓMICO: el `updateMany` con guard `paymentStatus` actúa como
      // test-and-set. Sin esto, dos rejects concurrentes (o un reject vs un
      // verify) podían sobreescribir mutuamente y `revertOrderImpact` corría
      // dos veces decrementando `totalSpent`/`ordersCount` doble. El filtro
      // `status:{not:CANCELLED}` previene tocar una orden que ya fue
      // cancelada por otro flujo.
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: { in: [PaymentStatus.AWAITING_VERIFICATION, PaymentStatus.PENDING] },
          // notIn refleja el guard de arriba también contra transiciones
          // concurrentes: si el pedido pasó a IN_DELIVERY/DELIVERED entre
          // el findFirst y este claim, no lo tocamos.
          status: { notIn: ["CANCELLED", "IN_DELIVERY", "DELIVERED"] },
        },
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
      if (claimed.count === 0) {
        throw new Error("__payment_status_changed__");
      }
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
  } catch (err) {
    if (err instanceof Error && err.message === "__payment_status_changed__") {
      return { error: "El estado del pago ya cambió. Recarga la página." };
    }
    throw err;
  }

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
        vertical: order.store.vertical,
      }),
    );
  }

  revalidatePath(`/${order.store.slug}/orden/${order.trackingToken}`);
  revalidatePath("/dashboard/pedidos");
  revalidatePath(`/dashboard/pedidos/${order.id}`);
  return { ok: true };
}

// ============== Marcar pago como reembolsado ==============
//
// Caso de uso: el owner ya verificó un pago (paymentStatus = VERIFIED) y
// posteriormente debe devolverlo — porque cancela el pedido por su lado,
// se equivocó al verificar, o el cliente lo solicitó. La devolución del
// dinero ocurre fuera de la app (WhatsApp + transferencia bancaria); esta
// action solo registra el estado contable para que los dashboards de
// revenue puedan excluir pedidos refundeados.
//
// Requisitos:
//   - Solo OWNER (no CASHIER) — caja es del dueño.
//   - paymentStatus actual debe ser VERIFIED. PENDING/AWAITING/REJECTED
//     no son válidos (no hay pago que devolver).
//   - El order puede estar en cualquier status — incluso DELIVERED si el
//     cliente devolvió el producto.

const refundSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3, "Indica el motivo del reembolso").max(280),
});

export async function markOrderRefundedAction(
  _prev: ActionState<"reason">,
  formData: FormData,
): Promise<ActionState<"reason">> {
  const { storeId, userId } = await requireOwnerOnlyIds();
  const parsed = refundSchema.safeParse({
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
      orderNumber: true,
      trackingToken: true,
      paymentStatus: true,
      store: { select: { slug: true } },
    },
  });
  if (!order) return { error: "Pedido no encontrado." };
  if (order.paymentStatus !== "VERIFIED") {
    return { error: "Solo se pueden reembolsar pagos verificados." };
  }

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });

  try {
    await db.$transaction(async (tx) => {
      // Claim atómico: solo transicionamos si paymentStatus sigue siendo
      // VERIFIED. Otro flujo concurrente (rejectPaymentAction tardío) podría
      // haber cambiado el estado entre el findFirst y este update.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: "VERIFIED" },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
          paymentRejectedReason: parsed.data.reason,
        },
      });
      if (claimed.count === 0) {
        throw new Error("__not_verified__");
      }
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "PAYMENT_REFUNDED",
          description: `Pago reembolsado: ${parsed.data.reason}`,
          byUserId: userId,
          byUserName: actor?.fullName ?? actor?.username ?? null,
        },
      });
      // Si el pedido aún no estaba cancelado, NO lo cancelamos automáticamente:
      // el owner puede reembolsar un DELIVERED como cortesía (cliente devolvió
      // físicamente). La decisión de cancelar es separada.
    });
  } catch (err) {
    if (err instanceof Error && err.message === "__not_verified__") {
      return { error: "El pago ya no está verificado. Recarga la página." };
    }
    throw err;
  }

  await audit({
    action: "order.payment.refunded",
    actorId: userId,
    storeId,
    target: order.id,
    metadata: { orderNumber: order.orderNumber, reason: parsed.data.reason },
  });

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
  // Rate limit por IP: la action es pública (token-based, sin sesión).
  // Aunque una cancelación exitosa es terminal (segundo intento devuelve
  // "ya cambió de estado"), spamear la action no cuesta nada al atacante.
  // 5 intentos / minuto es generoso para un cliente legítimo.
  const ip = await getClientIp();
  const rl = await rateLimit(`customer-cancel:${ip}`, 5, 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
  }

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
      return { error: "Este pedido ya cambió de estado. Recarga la página." };
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

