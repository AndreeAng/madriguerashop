import "server-only";

/**
 * Tipos del módulo SIAT.
 *
 * Estos tipos son **API pública** del módulo: importar desde acá no desde
 * archivos internos. Cualquier cambio acá puede romper consumidores.
 */

export type SiatModalidad = "COMPUTARIZADA_EN_LINEA" | "ELECTRONICA_EN_LINEA";

/**
 * Credenciales SIAT por Store. Se cargan de DB cuando se va a emitir.
 */
export type SiatCredentials = {
  storeId: string;
  nit: string;
  razonSocial: string;
  sucursalCodigo: number;
  puntoVentaCodigo: number;
  /** Token delegado del merchant. CIFRADO en DB; se descifra acá. */
  tokenDelegado: string;
  modalidad: SiatModalidad;
  actividadEconomica: string;
  leyenda: string | null;
};

/**
 * Item de factura — corresponde a una OrderItem del pedido.
 */
export type SiatLineItem = {
  /** Código SIN del producto (mapeo en ProductSiatMapping). */
  codigoProductoSin: string;
  /** Código interno del SaaS (Product.id o sku). */
  codigoProducto: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: number; // código SIN
  precioUnitario: number;
  montoDescuento: number;
  subTotal: number;
};

/**
 * Input para construir una factura. Lo arma `builder.ts` desde un Order.
 */
export type FacturaInput = {
  cuf: string;
  cufd: string;
  numeroFactura: number;
  fechaEmision: Date;

  emisor: {
    nit: string;
    razonSocial: string;
    municipio: string;
    sucursal: number;
    puntoVenta: number;
    /**
     * Código de actividad económica del NIT — viene de
     * `SiatCredentials.actividadEconomica`. SIN lo exige en CADA detalle de
     * factura. NO confundir con `sucursal` (eso es el número de sucursal,
     * código distinto). Antes el builder emitía sucursal por error, lo que
     * causaba rechazo 906.
     */
    actividadEconomica: string;
  };

  cliente: {
    /** "0" para consumidor final sin NIT. */
    documento: string;
    /** Tipo doc SIN: 1=CI, 2=Carné Extranjero, 3=Pasaporte, 4=NIT, 5=OTRO */
    tipoDocumento: 1 | 2 | 3 | 4 | 5;
    nombre: string;
    /** Email del cliente para envío del CUF (opcional). */
    email?: string;
  };

  items: SiatLineItem[];

  montoSubtotal: number;
  montoDescuento: number;
  montoGiftCard: number;
  montoTotal: number;
  montoTotalSujetoIva: number;
  codigoMoneda: number; // 1 = BOB
  tipoCambio: number; // 1 si BOB
  metodoPago: number; // 1 = efectivo, 2 = QR, 6 = transferencia, etc.

  leyenda: string;
  /** "Usuario" en SIAT — quién operó la caja. */
  usuario: string;
};

/**
 * Respuesta del SIN al recibir una factura.
 */
export type RecepcionFacturaResponse = {
  transaccion: boolean;
  codigoEstado: number;
  codigoDescripcion: string;
  codigoRecepcion: string;
  fechaProceso: string;
  mensajesList: { codigo: number; descripcion: string }[];
};

/** Cache entry para CUIS/CUFD. */
export type SiatCodeEntry = {
  type: "CUIS" | "CUFD";
  code: string;
  expiresAt: Date;
};
