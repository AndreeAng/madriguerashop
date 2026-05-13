/**
 * Commitlint: valida que cada commit message siga Conventional Commits.
 *
 * Formato:
 *   <type>(<scope>): <subject>
 *
 * type:   feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
 * scope:  opcional, en kebab-case (ej. auth, orders, siat, dashboard)
 * subject: imperativo, sin punto final, max 100 chars
 *
 * Ejemplos:
 *   feat(orders): allow CASHIER to mark IN_DELIVERY
 *   fix(auth): rotate JWT on suspension within 60s
 *   chore(deps): bump prisma to 5.22.0
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Subject sin punto final
    "subject-full-stop": [2, "never", "."],
    // Subject no en sentence-case ni CAPS
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    // Header total ≤ 100 chars (default es 72, lo subimos un poco para PRs)
    "header-max-length": [2, "always", 100],
    // Body envuelto a 100 chars
    "body-max-line-length": [1, "always", 100],
  },
};

export default config;
