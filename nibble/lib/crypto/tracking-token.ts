import "server-only";
import crypto from "node:crypto";

/**
 * Token público unguessable para que un cliente SIN cuenta acceda a su
 * pedido (`/[slug]/orden/[token]`) o reserva (`/[slug]/reserva/[token]`).
 *
 * 16 bytes aleatorios → 22 caracteres base64url ≈ 132 bits de entropía:
 * imposible de adivinar por fuerza bruta, seguro para viajar en URLs
 * (WhatsApp, email) sin auth adicional. Es el único mecanismo de
 * autorización de esas páginas — tratarlo como un secreto del cliente.
 *
 * Vivía duplicado en orders.ts y bookings.ts; una sola fuente evita que
 * una futura "optimización" en uno de los dos degrade la entropía.
 */
export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}
