-- Restaura tres cambios de schema que fueron dropeados por error en la
-- migration `20260512150638_booking_completed_at` (un "drift cleanup" mezcló
-- drops legítimos con drops válidos):
--
--   1) Índice en `Order.couponId`         — necesario para el badge "X usos"
--      del dashboard de cupones (Seq Scan sobre `Order` sin él).
--   2) Índice en `PageView.visitorToken`  — necesario para agregaciones de
--      visitantes únicos en analytics (PageView es la tabla más grande).
--   3) FK `StoreOrderCounter.storeId` → `Store.id` con ON DELETE CASCADE —
--      previene counters huérfanos cuando una tienda es borrada.
--
-- Notas para producción:
--   - `IF NOT EXISTS` permite reaplicar la migration idempotentemente si
--     un hotfix manual ya restauró parcialmente el schema.
--   - Los `CREATE INDEX` corren BLOQUEANTES con `prisma migrate deploy`.
--     En tablas grandes (Order/PageView) considerar ejecutarlos manualmente
--     con `CREATE INDEX CONCURRENTLY` antes del deploy. Ver runbook de DB.

CREATE INDEX IF NOT EXISTS "Order_couponId_idx" ON "Order"("couponId");

CREATE INDEX IF NOT EXISTS "PageView_visitorToken_idx" ON "PageView"("visitorToken");

-- DROP+ADD idempotente: si la FK ya existe (por un hotfix manual en prod
-- aplicando la migration 20260510000005 sin que después corriera
-- 20260512150638 que la dropea), el ADD directo tira `duplicate_object`
-- y aborta toda la migration. Forzamos DROP IF EXISTS primero para que
-- el resultado sea siempre el mismo estado final.
ALTER TABLE "StoreOrderCounter"
  DROP CONSTRAINT IF EXISTS "StoreOrderCounter_storeId_fkey";

ALTER TABLE "StoreOrderCounter"
  ADD CONSTRAINT "StoreOrderCounter_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
