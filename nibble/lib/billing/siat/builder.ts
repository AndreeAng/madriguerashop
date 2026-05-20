import "server-only";
import { inBolivia } from "@/lib/booking/timezone";
import type { FacturaInput } from "./types";

/**
 * Construye el XML de Factura Computarizada Compra-Venta según el XSD oficial.
 *
 * Implementación real recomendada:
 *   - usar `xmlbuilder2` para no escribir strings concatenados
 *   - validar contra el XSD oficial con `xsd-schema-validator` antes de enviar
 *   - los XSD están en https://siatinfo.impuestos.gob.bo
 *   - firmar con XMLDSig (requisito SIN para modalidad electrónica en línea)
 *     antes de enviar a `recepcionFactura`.
 *
 * Por ahora retorna un esqueleto con los campos correctos pero no validado.
 */
export function buildFacturaXml(input: FacturaInput): string {
  // `fechaEmision` debe ir en hora Bolivia (UTC-4). `toISOString()` emite
  // UTC, así que una factura emitida 21:00 BOT quedaría con la fecha del
  // día siguiente — el SIN rechaza con 904/911 al no encontrar el CUFD
  // correspondiente al día declarado.
  const fmtDate = (d: Date) => {
    const b = inBolivia(d);
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return (
      `${b.year}-${pad(b.month + 1)}-${pad(b.day)}` +
      `T${pad(b.hours)}:${pad(b.minutes)}:${pad(b.seconds)}.${pad(b.milliseconds, 3)}`
    );
  };
  const fmtMoney = (n: number) => n.toFixed(2);

  const items = input.items
    .map(
      (it) => `
    <detalle>
      <actividadEconomica>${escapeXml(input.emisor.actividadEconomica)}</actividadEconomica>
      <codigoProductoSin>${escapeXml(it.codigoProductoSin)}</codigoProductoSin>
      <codigoProducto>${escapeXml(it.codigoProducto)}</codigoProducto>
      <descripcion>${escapeXml(it.descripcion)}</descripcion>
      <cantidad>${it.cantidad}</cantidad>
      <unidadMedida>${it.unidadMedida}</unidadMedida>
      <precioUnitario>${fmtMoney(it.precioUnitario)}</precioUnitario>
      <montoDescuento>${fmtMoney(it.montoDescuento)}</montoDescuento>
      <subTotal>${fmtMoney(it.subTotal)}</subTotal>
    </detalle>`.trim(),
    )
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<facturaComputarizadaCompraVenta xmlns="http://facturaelectronica.sin.gob.bo/facturaComputarizadaCompraVenta">
  <cabecera>
    <nitEmisor>${escapeXml(input.emisor.nit)}</nitEmisor>
    <razonSocialEmisor>${escapeXml(input.emisor.razonSocial)}</razonSocialEmisor>
    <municipio>${escapeXml(input.emisor.municipio)}</municipio>
    <telefono></telefono>
    <numeroFactura>${input.numeroFactura}</numeroFactura>
    <cuf>${escapeXml(input.cuf)}</cuf>
    <cufd>${escapeXml(input.cufd)}</cufd>
    <codigoSucursal>${input.emisor.sucursal}</codigoSucursal>
    <direccion></direccion>
    <codigoPuntoVenta>${input.emisor.puntoVenta}</codigoPuntoVenta>
    <fechaEmision>${fmtDate(input.fechaEmision)}</fechaEmision>
    <nombreRazonSocial>${escapeXml(input.cliente.nombre)}</nombreRazonSocial>
    <codigoTipoDocumentoIdentidad>${input.cliente.tipoDocumento}</codigoTipoDocumentoIdentidad>
    <numeroDocumento>${escapeXml(input.cliente.documento)}</numeroDocumento>
    <complemento></complemento>
    <codigoCliente>${escapeXml(input.cliente.documento)}</codigoCliente>
    <codigoMetodoPago>${input.metodoPago}</codigoMetodoPago>
    <numeroTarjeta></numeroTarjeta>
    <montoTotal>${fmtMoney(input.montoTotal)}</montoTotal>
    <montoTotalSujetoIva>${fmtMoney(input.montoTotalSujetoIva)}</montoTotalSujetoIva>
    <codigoMoneda>${input.codigoMoneda}</codigoMoneda>
    <tipoCambio>${fmtMoney(input.tipoCambio)}</tipoCambio>
    <montoTotalMoneda>${fmtMoney(
      // En BOB (tipoCambio = 1) montoTotalMoneda == montoTotal. En cualquier
      // otra moneda el SIN espera el total CONVERTIDO a esa moneda. Antes
      // siempre se enviaba `montoTotal` en BOB, produciendo facturas
      // rechazadas con código 980 o, peor, válidas pero con monto erróneo
      // reportado al fisco.
      input.tipoCambio === 1 ? input.montoTotal : input.montoTotal / input.tipoCambio,
    )}</montoTotalMoneda>
    <montoGiftCard>${fmtMoney(input.montoGiftCard)}</montoGiftCard>
    <descuentoAdicional>${fmtMoney(input.montoDescuento)}</descuentoAdicional>
    <codigoExcepcion>0</codigoExcepcion>
    <cafc></cafc>
    <leyenda>${escapeXml(input.leyenda)}</leyenda>
    <usuario>${escapeXml(input.usuario)}</usuario>
    <codigoDocumentoSector>1</codigoDocumentoSector>
  </cabecera>
  ${items}
</facturaComputarizadaCompraVenta>`;
}

// Renombrado para no shadowear el `escape()` global (que hace URL-encoding,
// no XML-encoding) — un rename accidental no rompe el escapeo silenciosamente.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
