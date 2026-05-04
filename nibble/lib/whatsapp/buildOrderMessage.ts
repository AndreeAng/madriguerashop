/**
 * Constructor del mensaje de pedido por WhatsApp.
 * SRS §req 24: link wa.me con mensaje precargado bonito y estructurado.
 *
 * El mensaje sale del cliente final hacia el dueño de la tienda.
 * Lo abre el cliente al confirmar; el dueño recibe TODO el pedido en su WhatsApp.
 */

export type WhatsAppOrderItem = {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
};

export type WhatsAppOrderInput = {
  storeName: string;
  orderNumber: number;
  trackingUrl: string;

  customerName: string;
  customerPhone: string;

  deliveryAddress: string;
  deliveryNote?: string | null;
  deliveryFee?: number | null;

  items: WhatsAppOrderItem[];

  subtotal: number;
  discountAmount?: number;
  total: number;

  paymentMethod: "QR_STATIC" | "QR_DYNAMIC" | "CASH_ON_DELIVERY";
  paymentProofUrl?: string | null;
  customerNotes?: string | null;
};

const PAYMENT_LABELS: Record<WhatsAppOrderInput["paymentMethod"], string> = {
  QR_STATIC: "QR del banco (comprobante adjunto)",
  QR_DYNAMIC: "QR dinámico",
  CASH_ON_DELIVERY: "Contra entrega",
};

function fmtBob(n: number): string {
  return new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Construye el cuerpo del mensaje. Devuelve el texto plano (no encoded).
 */
export function buildOrderMessage(input: WhatsAppOrderInput): string {
  const lines: string[] = [];

  lines.push(`🧾 *Pedido #${input.orderNumber}* — ${input.storeName}`);
  lines.push("");
  lines.push(`*Cliente:* ${input.customerName}`);
  lines.push(`*Teléfono:* ${input.customerPhone}`);
  lines.push("");

  // Items
  lines.push("*Tu pedido:*");
  for (const item of input.items) {
    const variant = item.variantName ? ` (${item.variantName})` : "";
    const itemTotal = item.unitPrice * item.quantity;
    lines.push(`• ${item.quantity}× ${item.name}${variant} — Bs ${fmtBob(itemTotal)}`);
    if (item.notes) {
      lines.push(`   _${item.notes}_`);
    }
  }
  lines.push("");

  // Cálculos
  lines.push(`*Subtotal:* Bs ${fmtBob(input.subtotal)}`);
  if (input.discountAmount && input.discountAmount > 0) {
    lines.push(`*Descuento:* -Bs ${fmtBob(input.discountAmount)}`);
  }
  if (input.deliveryFee != null) {
    lines.push(`*Envío:* Bs ${fmtBob(input.deliveryFee)}`);
  }
  lines.push(`*Total:* *Bs ${fmtBob(input.total)}*`);
  lines.push("");

  // Entrega
  lines.push("*Dirección de entrega:*");
  lines.push(input.deliveryAddress);
  if (input.deliveryNote) {
    lines.push(`_${input.deliveryNote}_`);
  }
  lines.push("");

  // Pago
  lines.push(`*Pago:* ${PAYMENT_LABELS[input.paymentMethod]}`);
  if (input.paymentProofUrl) {
    lines.push(`Comprobante: ${input.paymentProofUrl}`);
  }
  lines.push("");

  // Notas del cliente
  if (input.customerNotes) {
    lines.push("*Notas:*");
    lines.push(input.customerNotes);
    lines.push("");
  }

  // Tracking
  lines.push(`Seguir pedido: ${input.trackingUrl}`);

  return lines.join("\n");
}

/**
 * Genera la URL completa wa.me con el mensaje encoded.
 *  - phone debe estar en formato E.164 sin "+" (wa.me lo prefiere así).
 *    Ej: "59171234567"
 */
export function buildWhatsAppUrl(phoneE164: string, message: string): string {
  const phone = phoneE164.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

/**
 * Helper combinado: dado el input, devuelve la URL lista para abrir.
 */
export function buildOrderWhatsAppUrl(
  storeWhatsappPhone: string,
  input: WhatsAppOrderInput,
): string {
  const message = buildOrderMessage(input);
  return buildWhatsAppUrl(storeWhatsappPhone, message);
}
