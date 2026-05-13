-- =================================================================
-- Sprint — Servicios reservables + tabla Booking
-- =================================================================
-- Productos pueden ser "reservables" (corte de pelo, manicure, masaje).
-- En vez de comprar+pedido tradicional, el cliente elige día y hora y
-- queda una Booking que el owner ve en el calendario del dashboard.
-- =================================================================

-- 1. Enum del estado de la reserva
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Campos de "bookable" en Product
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "isBookable"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bookingDurationMin" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "bookingBufferMin"   INTEGER NOT NULL DEFAULT 0;

-- 3. Tabla Booking
CREATE TABLE IF NOT EXISTS "Booking" (
  "id"            TEXT NOT NULL,
  "storeId"       TEXT NOT NULL,
  "productId"    TEXT NOT NULL,
  "customerName"  TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT,
  "notes"         TEXT,
  "startsAt"      TIMESTAMP(3) NOT NULL,
  "endsAt"        TIMESTAMP(3) NOT NULL,
  "status"        "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "trackingToken" TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "confirmedAt"   TIMESTAMP(3),
  "cancelledAt"   TIMESTAMP(3),
  "cancelReason"  TEXT,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_trackingToken_key" ON "Booking" ("trackingToken");
CREATE INDEX        IF NOT EXISTS "Booking_productId_startsAt_idx" ON "Booking" ("productId", "startsAt");
CREATE INDEX        IF NOT EXISTS "Booking_storeId_startsAt_idx"   ON "Booking" ("storeId", "startsAt");
CREATE INDEX        IF NOT EXISTS "Booking_status_idx"             ON "Booking" ("status");

ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_storeId_fkey",
  ADD CONSTRAINT "Booking_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_productId_fkey",
  ADD CONSTRAINT "Booking_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
