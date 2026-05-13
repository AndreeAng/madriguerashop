import type { ZodError } from "zod";

/**
 * Convierte issues de un `ZodError` en un mapa `{ campo: mensaje }` plano
 * que las server actions devuelven al cliente como `fieldErrors`.
 *
 * Reglas:
 *   - La key es `issue.path[0]` (los paths anidados se proyectan al primer
 *     nivel — suficiente para nuestros forms planos).
 *   - El primer mensaje por campo gana (consistente con el patrón previo
 *     copiado en 14 archivos).
 *   - Si no hay paths definidos, el issue se ignora.
 *
 * Ejemplo:
 * ```ts
 * if (!parsed.success) {
 *   return { fieldErrors: zodIssuesToFieldErrors<"email" | "password">(parsed.error) };
 * }
 * ```
 */
export function zodIssuesToFieldErrors<K extends string>(
  error: ZodError,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as K | undefined;
    if (!key) continue;
    if (out[key]) continue;
    out[key] = issue.message;
  }
  return out;
}
