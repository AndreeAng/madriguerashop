import "server-only";

/**
 * Configuración SIAT — URLs, modalidades, sistema certificado.
 *
 * Las URLs son las oficiales del SIN. Verificar siempre en
 * https://siatinfo.impuestos.gob.bo antes de un deploy nuevo.
 */

export type SiatMode = "sandbox" | "production";

const SANDBOX_BASE = "https://pilotosiatservicios.impuestos.gob.bo/v1";
const PRODUCTION_BASE = "https://siatrest.impuestos.gob.bo/v1";

function mode(): SiatMode {
  return (process.env.SIAT_MODE as SiatMode) || "sandbox";
}

export const siatConfig = {
  mode: mode(),

  /** Código del sistema asignado por el SIN al certificar. */
  sistemaCodigo: process.env.SIAT_SISTEMA_CODIGO || "",

  /** URLs WSDL para los servicios. */
  endpoints: {
    facturacion:
      mode() === "sandbox"
        ? `${SANDBOX_BASE}/FacturacionPrueba?wsdl`
        : `${PRODUCTION_BASE}/FacturacionElectronica?wsdl`,
    operaciones:
      mode() === "sandbox"
        ? `${SANDBOX_BASE}/FacturacionOperaciones?wsdl`
        : `${PRODUCTION_BASE}/FacturacionOperaciones?wsdl`,
    sincronizacion:
      mode() === "sandbox"
        ? `${SANDBOX_BASE}/FacturacionSincronizacion?wsdl`
        : `${PRODUCTION_BASE}/FacturacionSincronizacion?wsdl`,
    codigos:
      mode() === "sandbox"
        ? `${SANDBOX_BASE}/FacturacionCodigos?wsdl`
        : `${PRODUCTION_BASE}/FacturacionCodigos?wsdl`,
  },

  /** Tiempo de vida del CUIS en cache (best-effort, el SIN puede expirarlo antes). */
  cuisTtlMs: 1000 * 60 * 60 * 12, // 12 horas

  /** Tiempo de vida del CUFD. SIN garantiza 24h. */
  cufdTtlMs: 1000 * 60 * 60 * 23, // refrescar antes que expire

  /** Modalidad por defecto al emitir. Override por Store si fuera necesario. */
  defaultModalidad: "COMPUTARIZADA_EN_LINEA" as const,
} as const;

/** Códigos del SIN — los más usados. Verificar contra RND vigente antes de prod. */
export const SIAT_CODES = {
  // Tipo de emisión (cabecera factura)
  EMISION_ONLINE: 1,
  EMISION_FUERA_LINEA: 2,
  EMISION_MASIVA: 3,

  // Tipo de factura
  TIPO_FACTURA_VENTA_IVA: 1,
  TIPO_FACTURA_VENTA_EXENTA: 2,

  // Modalidad (en CUF)
  MODALIDAD_COMPUTARIZADA: 1,
  MODALIDAD_ELECTRONICA: 2,

  // Tipo documento sector
  SECTOR_ESTANDAR: 1,
  SECTOR_EDUCATIVO: 11,
  SECTOR_HIDROCARBUROS: 18,
  // ... ver RND vigente para la lista completa

  // Códigos de respuesta del SIN a recepcionFactura (`codigoEstado` del
  // RecepcionFacturaResponse). Antes acá había también `ESTADO_ANULADA: 905`,
  // pero 905 ES "XML mal formado" (ver errors.ts) — eran códigos
  // semánticamente distintos forzados al mismo número. Los estados de
  // factura ANULADA / VIGENTE / DRAFT son **internos** al SaaS (ver
  // `SiatLocalStatus` abajo), no códigos del SIN.
  CODIGO_RESPUESTA_VALIDA: 908,
  CODIGO_RESPUESTA_OBSERVADA: 909,
  CODIGO_RESPUESTA_RECHAZADA: 910,
} as const;

/**
 * Estado interno del SaaS para una `SiatInvoice`. NO son códigos del SIN —
 * son nuestra forma de trackear qué pasó con cada factura emitida.
 *
 *  - DRAFT: construida en memoria pero no enviada (raro, solo en retries).
 *  - VIGENTE: el SIN aceptó (codigoEstado 908). Es el estado feliz.
 *  - OBSERVADA: el SIN aceptó pero con warnings (909). Requiere review.
 *  - RECHAZADA: el SIN rechazó (910). No emite efectos fiscales.
 *  - ANULADA: el merchant llamó a `anulacionFactura` exitosamente dentro
 *    de las 96h hábiles. Permanece en el libro como anulada.
 */
export type SiatLocalStatus =
  | "DRAFT"
  | "VIGENTE"
  | "OBSERVADA"
  | "RECHAZADA"
  | "ANULADA";

export function siatLocalStatusFromCodigo(codigo: number): SiatLocalStatus {
  if (codigo === SIAT_CODES.CODIGO_RESPUESTA_VALIDA) return "VIGENTE";
  if (codigo === SIAT_CODES.CODIGO_RESPUESTA_OBSERVADA) return "OBSERVADA";
  if (codigo === SIAT_CODES.CODIGO_RESPUESTA_RECHAZADA) return "RECHAZADA";
  // Cualquier otro código (4xx, 9xx de error de XML/auth) cuenta como
  // RECHAZADA para nuestro tracking — la factura no existe fiscalmente.
  return "RECHAZADA";
}
