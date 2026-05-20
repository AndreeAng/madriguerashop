import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "public/uploads/**",
      "prisma/migrations/**",
      "next-env.d.ts",
      // Sólo los configs de tooling (next, tailwind, eslint mismo, etc.).
      // Sentry y otros configs de runtime sí los lintamos — su código corre
      // en producción y un `any` no debería pasar desapercibido.
      "next.config.ts",
      "tailwind.config.ts",
      "postcss.config.mjs",
      "playwright.config.ts",
      "vitest.config.mts",
      "eslint.config.mjs",
    ],
  },
  {
    rules: {
      // `any` es error por default. Para los pocos lugares donde sea
      // legítimo (interop SOAP/XML, types de librerías sin .d.ts) usar
      // `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
      // con un comentario explicando por qué.
      "@typescript-eslint/no-explicit-any": "error",
      // Server actions y forms a veces usan `_unused` props
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `@typescript-eslint/no-floating-promises` requiere type-aware
      // linting (parserOptions.project apuntando a tsconfig). Habilitarlo
      // implica reconfigurar el flat config con `languageOptions` extra y
      // duplica el tiempo de lint (parse del tsconfig en cada archivo).
      // Por ahora confiamos en `tsc --noEmit` del CI para detectar
      // promesas mal manejadas vía type errors (e.g. asignar Promise a un
      // tipo no-Promise). Si se activa después, hacerlo en su propio
      // PR con benchmarks de performance.
    },
  },
];
