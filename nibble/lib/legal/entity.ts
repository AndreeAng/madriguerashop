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

export const LEGAL_ENTITY: LegalEntity = {
  name: process.env.LEGAL_ENTITY_NAME ?? "",
  address: process.env.LEGAL_ENTITY_ADDRESS ?? "",
  taxId: process.env.LEGAL_ENTITY_TAX_ID,
  contactEmail: process.env.LEGAL_ENTITY_CONTACT_EMAIL ?? "hola@madrigueras.shop",
};

/** ¿Están seteados los datos mínimos para que el documento legal sea válido? */
export function isLegalEntityComplete(): boolean {
  return Boolean(LEGAL_ENTITY.name) && Boolean(LEGAL_ENTITY.address);
}

/** Texto seguro para los párrafos legales. Si falta data, dice "Madriguera Shop". */
export function legalEntityName(): string {
  return LEGAL_ENTITY.name || "Madriguera Shop";
}

export function legalEntityAddress(): string {
  return LEGAL_ENTITY.address || "Cochabamba, Bolivia";
}
