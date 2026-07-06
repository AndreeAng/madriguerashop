import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vitest NO carga los archivos `.env` a `process.env` por su cuenta, así que
// `TEST_DATABASE_URL` puesta en `.env.local` no llegaba al setup y había que
// exportarla en el shell en cada corrida. `loadEnv` lee .env/.env.local/
// .env.test y la inyectamos vía `test.env` (abajo). Si no existe, queda
// undefined y el setup muestra el mensaje de ayuda como antes.
const fileEnv = loadEnv("test", __dirname, "");
const injectedEnv: Record<string, string> = {};
if (fileEnv.TEST_DATABASE_URL)
  injectedEnv.TEST_DATABASE_URL = fileEnv.TEST_DATABASE_URL;

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
    // Inyecta TEST_DATABASE_URL desde `.env.local` (ver loadEnv arriba).
    env: injectedEnv,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
