import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
    globals: true,
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
