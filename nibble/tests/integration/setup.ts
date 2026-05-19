/**
 * Setup para tests de integración. Corre UNA VEZ antes del primer test.
 *
 * Valida que `TEST_DATABASE_URL` está seteado — sino el resto de tests
 * fallaría con errores oscuros de Prisma "DATABASE_URL not found".
 */
if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "\n[integration] TEST_DATABASE_URL no está seteado.\n" +
      "Crear una branch en Neon y exportar la pooled URL:\n" +
      "  TEST_DATABASE_URL='postgresql://...-pooler.../dbname?sslmode=require'\n" +
      "Después correr migrations:\n" +
      "  DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy\n",
  );
  process.exit(1);
}

// Prisma lee DATABASE_URL por defecto. Para que use la test URL sin tener
// que reconfigurar `lib/db.ts`, le seteamos DATABASE_URL al valor de test
// en el contexto del proceso vitest.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
