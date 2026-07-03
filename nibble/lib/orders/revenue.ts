import { OrderStatus, PaymentStatus, type Prisma } from "@prisma/client";

/**
 * Filtro canónico de "venta real" para TODA métrica de revenue/GMV.
 *
 * Quedan fuera:
 *   - CANCELLED: no se cobró.
 *   - PENDING_PAYMENT: QR sin verificar — el comprobante puede ser falso;
 *     hasta que el owner verifica, no es venta.
 *   - paymentStatus REFUNDED: se cobró y se devolvió. El schema lo exige
 *     explícitamente ("cualquier dashboard que cuente revenue debe filtrar
 *     paymentStatus != REFUNDED") y `markOrderRefundedAction` existe
 *     precisamente para esto.
 *
 * Antes cada superficie tenía su propia versión (el home del owner no
 * filtraba NADA, el admin solo excluía CANCELLED, analytics excluía
 * CANCELLED+PENDING_PAYMENT pero no REFUNDED) y los números no cuadraban
 * entre pantallas. Usar SIEMPRE este objeto vía spread:
 *
 *   db.order.aggregate({ where: { storeId, ...REAL_SALE_WHERE } })
 *
 * Las queries $queryRaw no pueden consumirlo — deben replicar:
 *   "status" NOT IN ('CANCELLED','PENDING_PAYMENT') AND "paymentStatus" != 'REFUNDED'
 */
export const REAL_SALE_WHERE = {
  status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT] },
  paymentStatus: { not: PaymentStatus.REFUNDED },
} satisfies Prisma.OrderWhereInput;
