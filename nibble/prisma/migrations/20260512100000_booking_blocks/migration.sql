-- =================================================================
-- Sprint — Bloqueos de disponibilidad para reservas
-- =================================================================
-- El owner puede marcar rangos de tiempo donde no atiende:
--   - Día entero (vacaciones, feriado personal).
--   - Horas sueltas (almuerzo, cita médica, capacitación).
-- El slot generator descarta cualquier slot que caiga dentro de un bloque.
-- =================================================================

CREATE TABLE IF NOT EXISTS "BookingBlock" (
  "id"        TEXT NOT NULL,
  "storeId"   TEXT NOT NULL,
  "startsAt"  TIMESTAMP(3) NOT NULL,
  "endsAt"    TIMESTAMP(3) NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingBlock_storeId_startsAt_idx"
  ON "BookingBlock" ("storeId", "startsAt");

ALTER TABLE "BookingBlock"
  DROP CONSTRAINT IF EXISTS "BookingBlock_storeId_fkey",
  ADD CONSTRAINT "BookingBlock_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
