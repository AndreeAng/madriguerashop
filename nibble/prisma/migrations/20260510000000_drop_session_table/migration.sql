-- NextAuth está configurado con strategy "jwt" sin PrismaAdapter, así que
-- esta tabla nunca tuvo filas escritas por la app. Se borra para evitar
-- confusión y limpiar el modelo del schema.

DROP TABLE IF EXISTS "Session";
