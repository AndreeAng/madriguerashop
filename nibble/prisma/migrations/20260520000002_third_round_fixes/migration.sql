-- Aggregated migration de la tercera ronda de fixes.
-- Todas las operaciones son idempotentes (IF NOT EXISTS / IF EXISTS).

-- 1) Order.newAt — timestamp del momento en que un pedido entra al flujo
--    activo. Para CoD coincide con createdAt; para QR se setea en la
--    verificación de pago (PENDING_PAYMENT → NEW).
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "newAt" TIMESTAMP(3);

-- 2) Index Order(storeId, paymentStatus) — el dashboard cuenta
--    AWAITING_VERIFICATION con un WHERE compuesto. Sin este índice
--    Postgres usa el existente (storeId, status) y post-filtra en memoria.
CREATE INDEX IF NOT EXISTS "Order_storeId_paymentStatus_idx"
  ON "Order"("storeId", "paymentStatus");

-- 3) CouponUsage.couponId — cambiar Cascade → Restrict. Borrar un cupón
--    no debe destruir el historial de uso (forensics + audit).
ALTER TABLE "CouponUsage"
  DROP CONSTRAINT IF EXISTS "CouponUsage_couponId_fkey";
ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Booking.product — cambiar Cascade → Restrict. Reservas confirmadas
--    no deben evaporarse silenciosamente si alguien hard-deletea un
--    producto. Consistente con OrderItem.product.
ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_productId_fkey";
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Drop índices redundantes (cubiertos por @@unique compuestos):
DROP INDEX IF EXISTS "Coupon_storeId_idx";
DROP INDEX IF EXISTS "Customer_storeId_idx";

-- 6) AuditLog: índice compuesto para paginación filtrada por action.
--    El index sobre createdAt separado deja de ser necesario para el
--    flujo principal pero lo mantenemos por consultas de "últimos N".
DROP INDEX IF EXISTS "AuditLog_action_idx";
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
  ON "AuditLog"("action", "createdAt" DESC);
