import { Prisma } from "@prisma/client";

/**
 * Impacto de un pedido sobre inventario + contadores del cliente.
 *
 * Extraído de la server action `order-management.ts` a un módulo plano para
 * (1) poder testear el round-trip apply↔revert contra una DB real sin
 * arrastrar la cadena de imports de Next/NextAuth, y (2) no exponer estos
 * helpers internos como server actions.
 *
 * Diseño: cada orden tiene un flag `stockApplied` que indica si su impacto
 * sobre inventario y métricas del cliente ya fue aplicado. CoD lo aplica al
 * crear; QR lo aplica al verificar. Cualquier cancelación lo revierte.
 *
 * Se ejecutan SIEMPRE dentro de una transacción (tx) para que el flag y las
 * mutaciones queden atómicos.
 */
type TxClient = Prisma.TransactionClient;

export async function applyOrderImpact(tx: TxClient, orderId: string): Promise<void> {
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

export async function revertOrderImpact(tx: TxClient, orderId: string): Promise<void> {
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
