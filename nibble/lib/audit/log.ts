import "server-only";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { pickFirstIp } from "@/lib/security/rateLimit";
import { hashIp } from "@/lib/crypto/hashIp";

/**
 * Acciones auditables — define el dominio. Tipo cerrado para que un typo
 * no genere logs huérfanos que no se pueden filtrar.
 */
export type AuditAction =
  // Auth
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.logout"
  | "auth.password_reset.requested"
  | "auth.password_reset.completed"
  // Onboarding
  | "store.registered"
  // Pedidos
  | "order.created"
  | "order.status_changed"
  | "order.payment.verified"
  | "order.payment.rejected"
  | "order.payment.refunded"
  | "order.exported"
  | "customer.exported"
  // Facturación SaaS
  | "invoice.generated"
  | "invoice.proof_uploaded"
  | "invoice.payment.verified"
  | "invoice.cancelled"
  // Tienda
  | "store.suspended"
  | "store.reactivated"
  // Banners
  | "banner.created"
  | "banner.updated"
  | "banner.deleted"
  // Popups
  | "popup.created"
  | "popup.updated"
  | "popup.deleted"
  // Cupones
  | "coupon.created"
  | "coupon.updated"
  | "coupon.deleted"
  // Zonas de delivery
  | "delivery_zone.created"
  | "delivery_zone.updated"
  | "delivery_zone.deleted"
  // Bloqueos de calendario (vacaciones, almuerzo)
  | "booking_block.created"
  | "booking_block.deleted"
  // Reservas
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.completed"
  | "booking.no_show"
  // Configuración de tienda (owner)
  | "store.settings_changed"
  // Catálogo (owner)
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.toggled_active"
  | "category.created"
  | "category.updated"
  | "category.deleted"
  | "category.toggled_visibility"
  | "category.reordered"
  // Impersonation (super admin entra/sale del dashboard de una tienda)
  | "saas.store_impersonation_started"
  | "saas.store_impersonation_ended"
  // Plataforma (super admin)
  | "saas.settings_changed"
  | "saas.template_created"
  | "saas.template_updated"
  | "saas.template_deleted"
  | "saas.user_suspended"
  | "saas.user_reactivated"
  | "saas.user_role_changed"
  | "saas.user_password_reset_sent"
  | "saas.alert_acknowledged"
  | "saas.alert_resolved"
  // Lifecycle de tiendas (acciones manuales del super admin desde
  // /admin/tiendas/[id], distintas del flujo automático de billing).
  | "saas.store_suspended"
  | "saas.store_reactivated"
  | "saas.store_deleted";

/**
 * Registra una entrada de auditoría. Nunca falla la operación principal:
 * cualquier error queda en console.error pero no propaga.
 *
 * Uso típico:
 *   await audit({
 *     action: "order.payment.verified",
 *     actorId: userId,
 *     target: orderId,
 *     metadata: { orderNumber, amount },
 *   });
 */
export async function audit(input: {
  action: AuditAction;
  storeId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { ip, userAgent } = await readRequestContext();
    await db.auditLog.create({
      data: {
        action: input.action,
        storeId: input.storeId ?? null,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        target: input.target ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] failed", { action: input.action, error: err });
  }
}

async function readRequestContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    // Reutilizamos `pickFirstIp` para no propagar headers no validados:
    // un cliente puede enviar `x-forwarded-for: <script>` sin trust-proxy y
    // contaminar la columna IP del audit log. `pickFirstIp` valida con
    // regex IPv4/IPv6 y descarta payloads inusuales.
    const fromXff = pickFirstIp(h.get("x-forwarded-for"));
    const fromReal = fromXff ?? pickFirstIp(h.get("x-real-ip"));
    // Y la hasheamos con la misma salt rotativa que analytics — la IP
    // cruda es PII y la política de privacidad declara "IP anonimizada"
    // para datos de auditoría.
    const ip = hashIp(fromReal);
    const userAgent = h.get("user-agent");
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}
