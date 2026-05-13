-- =================================================================
-- Sprint 15 — Corrección de schema drift detectada en 2ª auditoría
-- =================================================================
-- Cuatro modelos del schema.prisma (CronRun, Alert, SaasSettings,
-- BillingCounter) nunca recibieron CREATE TABLE en ninguna migration.
-- Prisma generaba el cliente como si existieran y las queries fallaban
-- en runtime con `relation does not exist`.
--
-- Además se corrigen:
--   • CartItem.productId sin FK (orphans silenciosos al borrar productos)
--   • AuditLog.storeId nunca creada como columna (datos perdidos al insert)
--   • Invoice (storeId, periodStart) sin unique (riesgo de doble facturación)
--   • Order.couponId y PageView.visitorToken sin índices
--   • StoreOrderCounter sin FK a Store
--   • Backfill mal hecho del stockApplied para PENDING_PAYMENT
-- =================================================================

-- 1. Enums faltantes ----------------------------------------------------
-- DO blocks idempotentes: CREATE TYPE no soporta IF NOT EXISTS en PG.

DO $$ BEGIN
  CREATE TYPE "CronRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AlertType" AS ENUM ('CRON_FAILED', 'PROOF_REUSED', 'LOGIN_ATTACK', 'STORE_TRAFFIC_DROP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tablas faltantes ---------------------------------------------------

-- 2a. CronRun: lock distribuido para crons idempotentes.
CREATE TABLE IF NOT EXISTS "CronRun" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "status"     "CronRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "error"      TEXT,
  "result"     JSONB,
  CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CronRun_name_startedAt_idx" ON "CronRun" ("name", "startedAt");

-- 2b. Alert: eventos operativos para super admin.
CREATE TABLE IF NOT EXISTS "Alert" (
  "id"               TEXT NOT NULL,
  "type"             "AlertType" NOT NULL,
  "severity"         "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
  "title"            TEXT NOT NULL,
  "description"      TEXT NOT NULL,
  "data"             JSONB,
  "storeId"          TEXT,
  "status"           "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "dedupeKey"        TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt"   TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "resolvedAt"       TIMESTAMP(3),
  "resolvedById"     TEXT,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Alert_dedupeKey_key"      ON "Alert" ("dedupeKey");
CREATE INDEX        IF NOT EXISTS "Alert_status_createdAt_idx" ON "Alert" ("status", "createdAt");
CREATE INDEX        IF NOT EXISTS "Alert_type_idx"            ON "Alert" ("type");
CREATE INDEX        IF NOT EXISTS "Alert_storeId_idx"         ON "Alert" ("storeId");

-- Alert.storeId → Store FK. SET NULL para preservar alertas históricas
-- si la tienda se borra (auditoría operativa cross-tenant).
ALTER TABLE "Alert"
  DROP CONSTRAINT IF EXISTS "Alert_storeId_fkey";
ALTER TABLE "Alert"
  ADD CONSTRAINT "Alert_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2c. SaasSettings: singleton de config global (id='default').
CREATE TABLE IF NOT EXISTS "SaasSettings" (
  "id"                   TEXT NOT NULL DEFAULT 'default',
  "paymentQrUrl"         TEXT,
  "paymentInstructions"  TEXT NOT NULL DEFAULT 'Escanea el QR y paga el monto exacto. Sube el comprobante para que verifiquemos.',
  "billingInvoicePrefix" TEXT NOT NULL DEFAULT 'NIB-',
  "billingDueDays"       INTEGER NOT NULL DEFAULT 7,
  "billingGraceDays"     INTEGER NOT NULL DEFAULT 5,
  "featureDynamicQr"     BOOLEAN NOT NULL DEFAULT false,
  "featureAiChatbot"     BOOLEAN NOT NULL DEFAULT false,
  "featureMultiBranch"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaasSettings_pkey" PRIMARY KEY ("id")
);

-- Sembrar la fila singleton para que el upsert del super admin siempre
-- encuentre algo (evita race en el primer acceso).
INSERT INTO "SaasSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 2d. BillingCounter: counter atómico para invoice number global.
CREATE TABLE IF NOT EXISTS "BillingCounter" (
  "id"      TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BillingCounter_pkey" PRIMARY KEY ("id")
);

-- Seed: contador "invoice" en 0 → primer invoice será 1.
INSERT INTO "BillingCounter" ("id", "current") VALUES ('invoice', 0)
ON CONFLICT ("id") DO NOTHING;

-- 3. CartItem.productId FK ----------------------------------------------
-- Limpieza defensiva de huérfanos (no debería haber, pero el FK lo
-- garantiza a futuro).
DELETE FROM "CartItem"
WHERE "productId" NOT IN (SELECT "id" FROM "Product");

ALTER TABLE "CartItem"
  DROP CONSTRAINT IF EXISTS "CartItem_productId_fkey";
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. AuditLog.storeId: columna + índice --------------------------------
-- El schema declaraba la columna desde el inicio pero la migration
-- original nunca la creó. Los inserts se ejecutaban sin el campo y los
-- datos se perdían silenciosamente (Prisma no falla al insertar campos
-- que no llegan al SQL final si el schema declara nullable).
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "storeId" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_storeId_idx" ON "AuditLog" ("storeId");

-- 5. Invoice unique (storeId, periodStart) -----------------------------
-- Garantiza idempotencia del cron de facturación mensual: no se puede
-- crear dos invoices para la misma tienda en el mismo periodo.
-- Defensivo: borrar duplicados antes (no-op esperado en prod).
DELETE FROM "Invoice"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "storeId", "periodStart"
             ORDER BY "createdAt"
           ) AS rn
    FROM "Invoice"
  ) t
  WHERE t.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_storeId_periodStart_key"
  ON "Invoice" ("storeId", "periodStart");

-- 6. Índices faltantes -------------------------------------------------
CREATE INDEX IF NOT EXISTS "Order_couponId_idx"        ON "Order"    ("couponId");
CREATE INDEX IF NOT EXISTS "PageView_visitorToken_idx" ON "PageView" ("visitorToken");

-- 7. StoreOrderCounter FK a Store --------------------------------------
-- Sprint 2 creó la tabla pero sin FK. Sin FK, una tienda borrada deja
-- counter huérfano y la próxima orden de otra tienda con el mismo id
-- (improbable, IDs son cuid) heredaría el counter.
ALTER TABLE "StoreOrderCounter"
  DROP CONSTRAINT IF EXISTS "StoreOrderCounter_storeId_fkey";
ALTER TABLE "StoreOrderCounter"
  ADD CONSTRAINT "StoreOrderCounter_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Backfill correctivo: Order.stockApplied --------------------------
-- Sprint 2 marcó stockApplied=true para todos los pedidos no-cancelled,
-- incluyendo PENDING_PAYMENT. Pero el código nuevo solo aplica stock
-- en verifyPayment / confirmación de admin. Si un pedido viejo
-- PENDING_PAYMENT se confirmara hoy, el flujo skipearía el decremento
-- de stock y rompería inventario.
UPDATE "Order"
   SET "stockApplied" = false
 WHERE "status"       = 'PENDING_PAYMENT'
   AND "stockApplied" = true;

-- 9. Customer (storeId, userId) índice regular -------------------------
-- El @@index([storeId, userId]) del schema declara un índice regular.
-- La unicidad real ya está enforced por el "Customer_storeId_userId_key"
-- parcial (Sprint 2, WHERE userId IS NOT NULL). Este índice regular es
-- redundante en términos de cobertura, pero evita que `prisma migrate
-- diff` reporte drift permanente entre la DSL y el estado de la DB.
CREATE INDEX IF NOT EXISTS "Customer_storeId_userId_idx"
  ON "Customer" ("storeId", "userId");
