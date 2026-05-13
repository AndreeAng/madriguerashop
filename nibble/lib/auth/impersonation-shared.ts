/**
 * Constante neutra compartida entre Edge (middleware / auth.config) y Node
 * (server actions, RSC). El módulo principal `impersonation.ts` tiene
 * `"server-only"` y por ende no se puede importar desde Edge — esta es
 * la separación canónica para que ambos lados lean el mismo nombre de
 * cookie sin duplicar el string en dos lugares.
 */
export const IMPERSONATION_COOKIE_NAME = "admin_impersonate_store";
