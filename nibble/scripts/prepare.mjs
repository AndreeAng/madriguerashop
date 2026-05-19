import { execSync } from "node:child_process";

// Husky setup que corre en `npm install` / `npm ci` vía el script `prepare`
// del package.json.
//
// En CI (GitHub Actions, Vercel, etc.) salteamos: husky es para hooks de
// git locales (pre-commit, commit-msg, etc.) — no aporta nada en un runner
// efímero. Además el binario vive en `nibble/node_modules/.bin/husky` y el
// script hace `cd ..` antes de invocarlo; en CI esa combinación rompe el
// PATH y husky no se encuentra (exit 127).
//
// Localmente sí instalamos los hooks para que lint-staged + commitlint
// validen cada commit del dev.

if (process.env.CI) {
  console.log("[prepare] CI environment detected → skipping husky setup");
  process.exit(0);
}

try {
  execSync("cd .. && husky", { stdio: "inherit" });
} catch (err) {
  // No fallar el install si husky tampoco está localmente (ej. primer
  // checkout antes del install completo). Solo loguear.
  console.warn("[prepare] husky setup failed (non-fatal):", err.message);
}
