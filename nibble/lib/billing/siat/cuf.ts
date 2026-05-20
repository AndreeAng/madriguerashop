import "server-only";
import { inBolivia } from "@/lib/booking/timezone";

/**
 * Algoritmo CUF (Código Único de Factura) — determinista.
 *
 * Estructura general (RND vigente):
 *   CUF = NIT (13) + fecha-emision (17, YYYYMMDDhhmmssfff) +
 *         sucursal (4) + modalidad (1) + tipoEmision (1) +
 *         tipoFactura (1) + tipoDocumentoSector (2) +
 *         numeroFactura (10) + puntoVenta (4) + verificador (Mod 11)
 *
 * Longitud total de la cadena base ANTES del verificador: 13+17+4+1+1+1+2+10+4 = 53.
 * El CUF resultante (hex + verificador) es de longitud fija, paddeado con
 * ceros a la izquierda en hex para no colapsar leading zeros del decimal.
 *
 * ⚠️ BLOQUEO DE ACTIVACIÓN: este algoritmo NO está validado contra los test
 * vectors oficiales del SIN. Antes de habilitar facturación real:
 *   1. Pasar Etapa de Pruebas del SIN con `SIAT_CUF_VALIDATED=true` en env.
 *   2. Comparar el CUF generado por esta función con el computado por la
 *      herramienta oficial para al menos 10 casos (con/sin leading zeros
 *      en NIT, números de factura altos, fechas con ms=0).
 *   3. Recién entonces remover el guard en `computeCUF`.
 */

export type CufInput = {
  nit: string; // hasta 13 dígitos
  fechaEmision: Date;
  sucursal: number;
  modalidad: 1 | 2; // 1 = computarizada, 2 = electrónica
  tipoEmision: 1 | 2 | 3; // 1 = online, 2 = fuera línea, 3 = masiva
  tipoFactura: 1 | 2; // 1 = venta IVA, 2 = exenta
  tipoDocumentoSector: number;
  numeroFactura: number;
  puntoVenta: number;
};

// Longitud máxima posible del hex de una cadena de 53 dígitos decimales.
// ceil(53 * log2(10) / 4) = 45. Paddeamos a 45 chars con leading zeros
// para que el CUF tenga siempre el mismo largo.
const CUF_HEX_LEN = 45;

export function computeCUF(input: CufInput): string {
  if (process.env.SIAT_CUF_VALIDATED !== "true") {
    throw new Error(
      "computeCUF está deshabilitado: el algoritmo aún no fue validado " +
        "contra los test vectors oficiales del SIN. Setear SIAT_CUF_VALIDATED=true " +
        "después de pasar Etapa de Pruebas. Ver lib/billing/siat/cuf.ts.",
    );
  }
  return unsafeComputeCUF(input);
}

/**
 * Versión sin guard — para tests y para uso en sandbox una vez validado.
 * NO usar directo en producción sin pasar por `computeCUF`.
 */
export function unsafeComputeCUF(input: CufInput): string {
  const partes = [
    input.nit.padStart(13, "0"),
    formatFecha(input.fechaEmision),
    String(input.sucursal).padStart(4, "0"),
    String(input.modalidad).padStart(1, "0"),
    String(input.tipoEmision).padStart(1, "0"),
    String(input.tipoFactura).padStart(1, "0"),
    String(input.tipoDocumentoSector).padStart(2, "0"),
    String(input.numeroFactura).padStart(10, "0"),
    String(input.puntoVenta).padStart(4, "0"),
  ].join("");

  // hex con padding fijo — sin esto, NITs con leading zeros producen un
  // CUF de longitud variable (bug latente: pasa tests con NIT "1234567890"
  // y rompe con "0123456789").
  const hex = numericToHex(partes).padStart(CUF_HEX_LEN, "0");
  const verificador = mod11(partes);

  return `${hex}${verificador}`;
}

function formatFecha(d: Date): string {
  // El CUF requiere fecha-hora en hora Bolivia (UTC-4). Si usáramos
  // `d.getHours()` directo, el cálculo dependería de la TZ del proceso
  // (Vercel corre en UTC) — una factura emitida 21:00 BOT generaría un
  // CUF con fecha del día siguiente, lo que el SIN rechaza con 905/970
  // y deja el correlativo gastado sin posibilidad de re-emisión.
  const b = inBolivia(d);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return [
    b.year,
    pad(b.month + 1),
    pad(b.day),
    pad(b.hours),
    pad(b.minutes),
    pad(b.seconds),
    pad(b.milliseconds, 3),
  ].join("");
}

/** Convierte una cadena numérica a hexadecimal en mayúsculas. */
function numericToHex(numStr: string): string {
  return BigInt(numStr).toString(16).toUpperCase();
}

/**
 * Dígito verificador Mod 11 sobre la cadena base.
 *
 * Algoritmo: multiplicar cada dígito (de derecha a izquierda) por 2..7
 * cíclico, sumar, mod 11. Si resto es 0 → "0", si es 1 → "1", si no → 11-resto.
 *
 * Verificar contra muestras del SIN antes de producción.
 */
function mod11(s: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = s.length - 1; i >= 0; i--) {
    suma += Number(s[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = suma % 11;
  if (resto === 0) return "0";
  if (resto === 1) return "1";
  return String(11 - resto);
}
