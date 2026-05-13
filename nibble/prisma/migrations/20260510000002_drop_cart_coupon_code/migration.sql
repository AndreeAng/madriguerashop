-- `Cart.couponCode` nunca se leyó ni escribió por la app. El cupón se aplica
-- al crear la Order (donde se persiste en `Order.couponCode`). Quitar la
-- columna evita confusión de "este campo existe, ¿debería usarlo?".

ALTER TABLE "Cart" DROP COLUMN IF EXISTS "couponCode";
