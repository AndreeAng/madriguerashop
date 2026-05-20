import { OrderStatus, PaymentStatus } from "@prisma/client";

/**
 * Transiciones permitidas entre estados. Define el flujo del pedido:
 *   NEW → CONFIRMED → PREPARING → IN_DELIVERY → DELIVERED
 *                                            ↘
 *                                              CANCELLED
 *
 * Cualquier transición fuera de este mapa es rechazada por la action.
 */
export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["NEW", "CANCELLED"],
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["IN_DELIVERY", "DELIVERED", "CANCELLED"],
  IN_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pago pendiente",
  NEW: "Nuevo",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  IN_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; fg: string }
> = {
  PENDING_PAYMENT: { bg: "bg-yellow-100", fg: "text-yellow-700" },
  NEW: { bg: "bg-amber-100", fg: "text-amber-700" },
  CONFIRMED: { bg: "bg-blue-100", fg: "text-blue-700" },
  PREPARING: { bg: "bg-purple-100", fg: "text-purple-700" },
  IN_DELIVERY: { bg: "bg-indigo-100", fg: "text-indigo-700" },
  DELIVERED: { bg: "bg-emerald-100", fg: "text-emerald-700" },
  CANCELLED: { bg: "bg-red-100", fg: "text-red-700" },
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  AWAITING_VERIFICATION: "Por verificar",
  VERIFIED: "Verificado",
  REJECTED: "Rechazado",
  REFUNDED: "Reembolsado",
};

/**
 * Pasos visibles en la timeline del cliente. CANCELLED se muestra aparte
 * con un treatment distinto.
 *
 * Texto neutro de vertical: antes "la cocina lo está revisando" sonaba
 * absurdo para tiendas de hardware/retail. Las descripciones son
 * universales — no asumen restaurante.
 */
export const TRACKING_STEPS: { key: OrderStatus; label: string; desc: string }[] = [
  { key: "PENDING_PAYMENT", label: "Pago pendiente", desc: "Sube el comprobante para que verifiquemos tu pago." },
  { key: "NEW", label: "Recibido", desc: "Lo tenemos. Estamos revisando tu pedido." },
  { key: "CONFIRMED", label: "Confirmado", desc: "Pago verificado. Empezamos a preparar." },
  { key: "PREPARING", label: "Preparando", desc: "Tu pedido está en preparación." },
  { key: "IN_DELIVERY", label: "En camino", desc: "Salió hacia tu dirección." },
  { key: "DELIVERED", label: "Entregado", desc: "Disfruta. ¡Gracias por elegirnos!" },
];

/** Retorna el índice del step actual (-1 si está cancelado o desconocido). */
export function trackingStepIndex(status: OrderStatus): number {
  return TRACKING_STEPS.findIndex((s) => s.key === status);
}
