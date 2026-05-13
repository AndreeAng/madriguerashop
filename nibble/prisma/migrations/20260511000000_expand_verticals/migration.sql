-- =================================================================
-- Expansión del enum StoreVertical
-- =================================================================
-- Agrega: BAKERY, GROCERY, BEAUTY, HEALTH, OTHER.
--
-- Estrategia: en Postgres, `ALTER TYPE ... ADD VALUE` NO puede correr
-- dentro de un transaction block sobre un tipo creado en migración
-- anterior. Prisma migrate wrappea todo en una transacción, así que
-- usamos la técnica canónica: crear un enum nuevo con todos los
-- valores, migrar las columnas que usan el viejo (Store.vertical,
-- Template.vertical) y dropear el viejo. Esto SÍ corre en transacción.
-- =================================================================

ALTER TYPE "StoreVertical" RENAME TO "StoreVertical_old";

CREATE TYPE "StoreVertical" AS ENUM (
  'RESTAURANT',
  'FOOD_TRUCK',
  'BAKERY',
  'GROCERY',
  'RETAIL',
  'HARDWARE',
  'BEAUTY',
  'HEALTH',
  'SERVICES',
  'OTHER'
);

ALTER TABLE "Store"
  ALTER COLUMN "vertical" TYPE "StoreVertical"
  USING "vertical"::text::"StoreVertical";

ALTER TABLE "Template"
  ALTER COLUMN "vertical" TYPE "StoreVertical"
  USING "vertical"::text::"StoreVertical";

DROP TYPE "StoreVertical_old";
