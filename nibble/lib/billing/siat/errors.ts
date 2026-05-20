import "server-only";

/**
 * Mapeo de códigos de error del SIN a mensajes legibles.
 *
 * Los códigos vienen en `RecepcionFacturaResponse.codigoEstado` o en el
 * array `mensajesList`. Esta tabla traduce los más comunes.
 *
 * Lista completa: SIAT publica catálogo `parametricaCodigosError`.
 */

export const SIAT_ERROR_MESSAGES: Record<number, string> = {
  // Éxito
  908: "Factura validada exitosamente.",
  909: "Factura observada — revisa los warnings.",

  // Errores de auth/sesión
  900: "Token inválido. Pide al merchant un nuevo token delegado.",
  901: "CUIS inválido o expirado. Reinicia el sistema.",
  902: "CUFD inválido o expirado. Refresca el CUFD del día.",
  903: "Token delegado expirado. El merchant debe renovarlo.",
  904: "CUFD del día expirado o no existe. Solicita uno nuevo.",

  // Errores de XML
  905: "XML mal formado. Bug nuestro — revisa el builder.",
  906: "Código de actividad económica no corresponde al NIT.",
  907: "Tipo de factura inválido.",

  // Errores de datos
  // Código 910 según catálogo SIN: "Recepción rechazada" (rechazo general
  // del envío). NIT no autorizado para la modalidad corresponde a 913.
  910: "Recepción rechazada por el SIN. Revisa `mensajesList` para el detalle del rechazo.",
  911: "Fuera del rango temporal permitido.",
  912: "Punto de venta no autorizado.",
  913: "NIT del emisor no autorizado para esta sucursal/modalidad.",

  // Errores de campos (típicos)
  //
  // El SIN no define un mensaje único para 970 — es la familia "validación
  // de campos". El detalle viene en `mensajesList` de la respuesta. El
  // mapping acá es el caso más frecuente observado en sandbox: documento
  // del cliente inválido. Para el resto, el caller debe inspeccionar
  // mensajesList y mostrar el texto que vino del SIN.
  970: "Validación de campos rechazada — revisa `mensajesList` (típicamente: documento del cliente inválido; usa '0' para consumidor final).",
  971: "Item sin código SIN. Mapea los productos antes de emitir.",
  972: "Cantidad de items excede el límite (250 por factura).",
  980: "Monto total no coincide con suma de items.",
};

export function describeSiatError(codigo: number): string {
  return (
    SIAT_ERROR_MESSAGES[codigo] ??
    `Código SIAT ${codigo} no documentado. Revisa la respuesta completa.`
  );
}

/**
 * Estrategia de reintento por código.
 *
 *  - "retry": intentar de nuevo (típicamente refrescando algo).
 *  - "manual": requiere intervención humana.
 *  - "fail": no es recuperable automáticamente.
 */
export type RetryStrategy = "retry_after_refresh" | "manual" | "fail";

export function retryStrategy(codigo: number): RetryStrategy {
  // Casos explícitos (refresh + retry automático)
  switch (codigo) {
    case 901: // CUIS expirado
    case 902: // CUFD expirado
    case 904: // CUFD del día no existe
      return "retry_after_refresh";
    case 900: // Token inválido
    case 903: // Token delegado expirado
      return "manual"; // el merchant tiene que renovar
  }
  // Errores de XML / NIT / actividad — bugs nuestros o config del merchant.
  if (codigo >= 905 && codigo < 920) return "fail";
  // Errores de datos (validación de campos)
  if (codigo >= 970) return "fail";
  return "manual";
}
