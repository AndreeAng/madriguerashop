-- `Store.cancelledAt` — timestamp dedicado para tiendas que pasaron a
-- CANCELLED. Antes el cálculo de churn usaba `suspendedAt`, lo que producía
-- métricas casi siempre nulas (suspended ≠ cancelled).
--
-- Backfill: para tiendas ya CANCELLED al deploy, copiar `updatedAt` como
-- mejor aproximación disponible.

ALTER TABLE "Store" ADD COLUMN "cancelledAt" TIMESTAMP(3);

UPDATE "Store"
  SET "cancelledAt" = "updatedAt"
  WHERE "status" = 'CANCELLED' AND "cancelledAt" IS NULL;
