/**
 * Lint-staged: corre solo sobre archivos staged en el commit.
 * Mucho más rápido que correr el linter sobre todo el repo.
 *
 * `--no-warn-ignored`: si un archivo del glob está en la lista de `ignores`
 * del eslint.config.mjs (ej. eslint.config.mjs mismo, next.config.ts), ESLint
 * emite un warning "File ignored" que con `--max-warnings=0` falla el commit
 * sin razón. Este flag silencia ESE warning específico — los demás siguen
 * fallando como antes.
 */
const ESLINT_CMD = "eslint --fix --max-warnings=0 --no-warn-ignored";

const config = {
  // TypeScript / TSX: ESLint --fix corrige formato/imports/etc. Si quedan
  // errores que no puede arreglar (no-explicit-any, unused-var sin _), falla
  // el commit. Acá NO corremos `tsc --noEmit` porque es por-archivo, no global —
  // eso queda al CI.
  "**/*.{ts,tsx}": [ESLINT_CMD],

  // JS / MJS / CJS: mismo linter.
  "**/*.{js,mjs,cjs}": [ESLINT_CMD],

  // Prisma schema: auto-format al cambiar.
  "prisma/schema.prisma": ["prisma format --schema"],
};

export default config;
