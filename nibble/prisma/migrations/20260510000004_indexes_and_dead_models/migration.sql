-- =================================================================
-- Sprint 14 — Schema cleanup: índices faltantes + drop dead models
-- =================================================================

-- 1. Índices faltantes
CREATE INDEX "PasswordReset_userId_idx"            ON "PasswordReset"   ("userId");
CREATE INDEX "ProductImage_productId_idx"          ON "ProductImage"    ("productId");
CREATE INDEX "ProductVariant_productId_idx"        ON "ProductVariant"  ("productId");
CREATE INDEX "Template_vertical_isActive_idx"      ON "Template"        ("vertical", "isActive");

-- 2. Modelos AiChatSession / AiChatMessage — eliminados
-- Eran scaffolding sin implementación. Si en V2 se construye el feature,
-- se vuelven a agregar con el scope real.
DROP TABLE IF EXISTS "AiChatMessage";
DROP TABLE IF EXISTS "AiChatSession";

-- 3. Store.plan: explicitar onDelete RESTRICT — antes era implícito (Prisma
-- default). Hacerlo explícito documenta la decisión: no se puede borrar un
-- Plan si hay Stores que lo usan.
ALTER TABLE "Store"
  DROP CONSTRAINT IF EXISTS "Store_planId_fkey",
  ADD CONSTRAINT "Store_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
