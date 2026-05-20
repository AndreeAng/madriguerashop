/**
 * Shape canónico que devuelven todas las server actions del proyecto.
 *
 * `ok`         → la acción ejecutó exitosamente. Puede llevar payload.
 * `error`      → error global de la acción (ej. "Tienda no encontrada").
 * `fieldErrors`→ errores por campo del form (mapean a inputs).
 *
 * El tipo vive acá (no en un archivo de dominio como `store-settings.ts`)
 * para que sea claro que es infraestructura compartida. Antes los 25+
 * consumidores hacían `import type { ActionState } from "@/server/actions/store-settings"`,
 * lo que sugería falsamente una dependencia de dominio.
 */
export type ActionState<F extends string = string> = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<F, string>>;
};

/**
 * Mensaje canónico cuando el parseo de Zod falla. Centralizado para que el
 * cliente vea el mismo texto en cualquier form — antes había variantes
 * "Datos inválidos" y "Input inválido" mezcladas, con la misma semántica.
 *
 * Si necesitas un mensaje más específico, usa `fieldErrors` con
 * `zodIssuesToFieldErrors(parsed.error)` que mapea por path; este string
 * es solo el fallback de error global cuando no puedes mapear por campo.
 */
export const INVALID_INPUT_ERROR = "Datos inválidos";
