-- =================================================================
-- Sprint 2 — Multi-tenancy, integridad referencial y atomicidad
-- =================================================================
-- Cambios:
--   1. Customer.userId: unique global → composite (storeId, userId)
--   2. OrderItem.productId: agregar FK con onDelete RESTRICT
--   3. Order.paymentVerifiedById: agregar FK con onDelete SET NULL
--   4. Invoice.verifiedById: agregar FK con onDelete SET NULL
--   5. Order.stockApplied: nueva columna (default false)
--   6. StoreOrderCounter: nuevo modelo para orderNumber atómico
--   7. CouponUsage: nuevo modelo para usageLimitPerUser
-- =================================================================

-- 1. Customer.userId: drop unique global, agregar composite con storeId.
DROP INDEX IF EXISTS "Customer_userId_key";
CREATE UNIQUE INDEX "Customer_storeId_userId_key"
  ON "Customer" ("storeId", "userId")
  WHERE "userId" IS NOT NULL;

-- 2. OrderItem.productId: FK con RESTRICT (un producto con ventas no se borra).
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"   ON "OrderItem" ("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");

-- 3. Order.paymentVerifiedById: FK con SET NULL (si el admin verificador se borra).
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_paymentVerifiedById_fkey"
  FOREIGN KEY ("paymentVerifiedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Invoice.verifiedById: FK con SET NULL.
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Order.stockApplied: nueva columna.
ALTER TABLE "Order"
  ADD COLUMN "stockApplied" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: para pedidos existentes, asumimos que el stock ya está decrementado
-- (porque el código viejo decrementaba siempre). Para pedidos CANCELLED, lo
-- dejamos en false (no debería restituirse — el cancel viejo no tocaba stock,
-- así que en realidad el stock decrementado ya quedó perdido — esto es legacy).
UPDATE "Order"
  SET "stockApplied" = true
  WHERE "status" != 'CANCELLED';

-- 6. StoreOrderCounter: counter atómico por tienda.
CREATE TABLE "StoreOrderCounter" (
  "storeId" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StoreOrderCounter_pkey" PRIMARY KEY ("storeId")
);

-- Backfill: sembrar counters con el max actual de orderNumber por tienda.
-- Tiendas sin pedidos quedan sin row; el upsert al crear el primer pedido
-- las crea con current=1.
INSERT INTO "StoreOrderCounter" ("storeId", "current")
SELECT "storeId", COALESCE(MAX("orderNumber"), 0)
FROM "Order"
GROUP BY "storeId";

-- 7. CouponUsage: registro de usos de cupón por cliente.
CREATE TABLE "CouponUsage" (
  "id"            TEXT NOT NULL,
  "couponId"      TEXT NOT NULL,
  "orderId"       TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponUsage_couponId_orderId_key" ON "CouponUsage" ("couponId", "orderId");
CREATE INDEX "CouponUsage_couponId_customerPhone_idx"  ON "CouponUsage" ("couponId", "customerPhone");

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CouponUsage"
  ADD CONSTRAINT "CouponUsage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
