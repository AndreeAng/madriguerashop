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

/**
 * Lee SIAT_MODE con validación estricta de enum. Un typo en la env var
 * (ej. `SIAT_MODE=produccion`) silenciosamente caía a "sandbox" antes;
 * con el log explícito el operador detecta el bug antes de emitir
 * facturas reales que no llegan al SIN. Default conservador: sandbox.
 */
function mode(): SiatMode {
  const raw = process.env.SIAT_MODE;
  if (raw === "production" || raw === "sandbox") return raw;
  if (raw) {
    console.error(
      `[siat] SIAT_MODE="${raw}" no es válido (esperado "production" | "sandbox"). Usando sandbox.`,
    );
  }
  return "sandbox";
}

/**
 * Construye el config lazy (cada invocación lee `process.env`). Antes
 * `siatConfig` era una constante evaluada en import-time, lo que rompía
 * tests (`vi.stubEnv` post-import no tenía efecto) y bloqueaba cambios
 * de modo en runtime. Mantenemos un `siatConfig` exportado como Proxy
 * para compatibilidad con los pocos callers existentes, pero la fuente
 * de verdad es `getSiatConfig()`.
 */
export function getSiatConfig() {
  const m = mode();
  const base = m === "sandbox" ? SANDBOX_BASE : PRODUCTION_BASE;
  const facturacionPath =
    m === "sandbox" ? "FacturacionPrueba" : "FacturacionElectronica";
  return {
    mode: m,
    sistemaCodigo: process.env.SIAT_SISTEMA_CODIGO || "",
    endpoints: {
      facturacion: `${base}/${facturacionPath}?wsdl`,
      operaciones: `${base}/FacturacionOperaciones?wsdl`,
      sincronizacion: `${base}/FacturacionSincronizacion?wsdl`,
      codigos: `${base}/FacturacionCodigos?wsdl`,
    },
    cuisTtlMs: 1000 * 60 * 60 * 12, // 12 horas
    cufdTtlMs: 1000 * 60 * 60 * 23, // refrescar antes que expire
    defaultModalidad: "COMPUTARIZADA_EN_LINEA" as const,
  } as const;
}

// Backwards-compat: el `siatConfig` exportado redirige a `getSiatConfig()`
// vía un getter dinámico. Callers nuevos deben usar `getSiatConfig()`.
export const siatConfig = new Proxy(
  {} as ReturnType<typeof getSiatConfig>,
  {
    get(_t, prop) {
      const cfg = getSiatConfig() as unknown as Record<string, unknown>;
      return cfg[prop as string];
    },
  },
);

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
