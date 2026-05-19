import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config para tests de INTEGRACIÓN — corren contra un Postgres real
 * (típicamente una branch de Neon dedicada o un container local).
 *
 * Diferencias vs `vitest.config.mts`:
 *   - Solo incluye `tests/integration/**`
 *   - `pool: "forks"` con `singleFork: true` — los tests comparten DB y
 *     deben correr SECUENCIALES, no en paralelo, para evitar interferencia.
 *   - Timeout más generoso (30s) porque queries a Neon cold-start tardan.
 *   - NO carga `tests/setup.ts` (no necesita TZ=UTC) pero verifica que
 *     `TEST_DATABASE_URL` está seteado.
 *
 * Setup manual (one-time):
 *   1. En el Neon dashboard, crear una BRANCH del proyecto (Branches →
 *      Create Branch). Llamala "test" o "ci-test".
 *   2. Copiar el connection string POOLED de esa branch.
 *   3. Exportar como `TEST_DATABASE_URL` en tu shell o `.env.local`:
 *        TEST_DATABASE_URL='postgresql://...-pooler.us-east-1.aws.neon.tech/...'
 *   4. Aplicar las migrations a esa branch:
 *        DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 *   5. Correr: `npm run test:integration`
 *
 * En CI, setear el secret `TEST_DATABASE_URL` en GitHub repo Settings.
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
