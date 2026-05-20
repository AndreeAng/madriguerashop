/**
 * Datos de la entidad legal que opera Madriguera Shop. SOURCE OF TRUTH ÚNICO.
 * Cuando se constituya la empresa formalmente, completar acá — los textos
 * legales de /terminos y /privacidad leen de este módulo y mostrarán un
 * banner de "borrador" mientras alguno de estos campos esté vacío.
 */

export type LegalEntity = {
  /** Razón social registrada. */
  name: string;
  /** Dirección legal (calle, número, ciudad). */
  address: string;
  /** NIT u otro identificador fiscal, si aplica. */
  taxId?: string;
  /** Email de contacto para temas legales / datos personales. */
  contactEmail: string;
};

/**
 * Lee la entidad legal cada vez que se invoca — antes era una constante
 * de módulo evaluada en import time, lo que cacheaba para siempre los
 * valores del primer cold start. Si en producción se rota una env var
 * vía feature flags / runtime config, las páginas legales mostraban el
 * valor viejo hasta el próximo deploy. Con función, cada request lee
 * el `process.env` actual.
 */
export function getLegalEntity(): LegalEntity {
  return {
    name: process.env.LEGAL_ENTITY_NAME ?? "",
    address: process.env.LEGAL_ENTITY_ADDRESS ?? "",
    taxId: process.env.LEGAL_ENTITY_TAX_ID,
    contactEmail:
      process.env.LEGAL_ENTITY_CONTACT_EMAIL ?? "hola@madrigueras.shop",
  };
}

/** ¿Están seteados los datos mínimos para que el documento legal sea válido? */
export function isLegalEntityComplete(): boolean {
  const e = getLegalEntity();
  return Boolean(e.name) && Boolean(e.address);
}

/** Texto seguro para los párrafos legales. Si falta data, dice "Madriguera Shop". */
export function legalEntityName(): string {
  return getLegalEntity().name || "Madriguera Shop";
}

export function legalEntityAddress(): string {
  return getLegalEntity().address || "Cochabamba, Bolivia";
}
