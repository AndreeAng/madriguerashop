import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
    globals: true,
    // `setupFiles` corre antes que cualquier test. Lo usamos para forzar
    // TZ=UTC y desbugear timezone tests entre dev (BOT) y CI (UTC).
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      reportsDirectory: "./coverage",
      // Medimos la lógica de negocio pura (lib/) + las server actions.
      // `all: true` reporta también los archivos que NINGÚN test toca (0%),
      // que es justo lo que queremos ver para priorizar. Los componentes
      // React y las rutas se cubren con Playwright (E2E), no acá.
      all: true,
      include: ["lib/**/*.ts", "server/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts", // módulos solo-de-tipos (no hay ejecutable que cubrir)
        "lib/db.ts", // singleton de PrismaClient — nada que testear
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` no existe como package real fuera del bundler de Next.js
      // — apunta a un módulo vacío para que `import "server-only"` no rompa
      // los tests unit.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
