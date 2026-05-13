---
name: siat-bolivia
description: Guía completa para implementar facturación electrónica SIAT (Bolivia, Servicio de Impuestos Nacionales) en una app multi-tenant. Cubre modalidades, tercer responsable, CUIS/CUFD, firma XMLDSig, XML schema, errores comunes y testing en sandbox. Usar cuando el usuario quiera integrar SIAT, emitir factura electrónica boliviana, o trabajar con `lib/billing/siat/`.
---

# SIAT Bolivia — Implementación end-to-end para SaaS multi-tenant

> **Tu cliente**: Madriguera Shop (operado por Nibble, S.R.L. boliviana). Vas a facturar tanto el SaaS al merchant **como** ofrecer al merchant facturar a sus clientes finales.
>
> **Documento de referencia legal**: RND N° 102100000011 (creación), modificada por RNDs posteriores. Verificar siempre la última versión vigente en [siatinfo.impuestos.gob.bo](https://siatinfo.impuestos.gob.bo).

---

## 1. Decisión arquitectónica clave: ¿qué modalidad?

SIAT define varias modalidades (RND 102100000011 art. 4):

| Modalidad | Firma | Cuándo conviene |
|---|---|---|
| **Manual** | Talonario físico autorizado | Solo emergencias |
| **Prevalorada** | Talonario físico con monto fijo | No aplica a un SaaS |
| **Computarizada en Línea** | **Firma Digital** (Token) | ✅ **RECOMENDADA para Madriguera Shop** |
| **Electrónica en Línea** | **Firma Electrónica** (certificado del emisor + XMLDSig) | Más estricta, requiere certificado por cada merchant |
| **Portal Web en Línea** | Token + UI del SIN | Para uso ocasional, sin sistema propio |

### ⭐ Recomendación: Facturación Computarizada en Línea

Razones:
1. **Firma digital en lugar de electrónica**: el SaaS firma con su sistema usando token, no necesitamos un certificado físico por cada merchant.
2. **El SIN autoriza** la factura (no el emisor) → menos responsabilidad técnica nuestra.
3. **Compatible con multi-tenant**: cada merchant da un **token delegado** al sistema (Madriguera Shop) para emitir en su nombre.
4. Es lo que usan la mayoría de los proveedores SaaS bolivianos (Sintic, NWC, etc.).

### Consecuencia práctica

Cada `Store` necesita estos datos antes de poder facturar:
- `nit` (Número de Identificación Tributaria del merchant)
- `razonSocial` (nombre legal)
- `sucursalCodigo` (default 0 = casa matriz)
- `puntoVentaCodigo` (default 0 si no hay sucursales)
- `tokenDelegado` (lo genera el merchant en su portal SIAT y nos lo entrega)
- `cuis` (lo obtiene Madriguera Shop al inicializar el sistema para esa Store)
- `sistemaCodigo` (Madriguera Shop tiene UN código de sistema autorizado por el SIN; lo asigna SIN al certificarnos)

---

## 2. Tercer Responsable / Token Delegado — el cómo legal

### Qué es
Un merchant (sujeto pasivo del IVA) puede autorizar a un tercero (Madriguera Shop) a emitir facturas en su nombre. Se llama **Tercer Responsable** o **Tercero Vinculado**.

### El flujo de autorización (lo hace el merchant, una vez):
1. Merchant entra a su **Oficina Virtual** del SIN con su NIT y contraseña.
2. Va a **Sistemas Asociados** → **Asociar Sistema**.
3. Busca "Madriguera Shop" (después de que SIN nos haya certificado y asignado un `sistemaCodigo`).
4. Genera un **token delegado** específico para nosotros.
5. Le entrega el token al merchant (lo pega en `/dashboard/facturacion/siat`).

### El flujo técnico (lo hace Madriguera Shop):
1. Almacena el `tokenDelegado` cifrado en la DB del merchant.
2. Para cada llamada SOAP a SIAT, agrega el header:
   ```
   Authorization: Token <tokenDelegado>
   ```
3. Si el token expira (~12 meses), solicita renovación al merchant.

### Pre-requisito importante

**Madriguera Shop debe estar certificado por el SIN como SFVL (Sistema de Facturación Virtual en Línea)** antes de que cualquier merchant pueda asociarse. Esto requiere:
- Constituirnos como S.R.L. con NIT activo.
- Pasar la **Etapa de Pruebas** del SIN (lote de facturas en sandbox).
- Pasar la **Etapa de Producción Controlada** (lote en prod con uso limitado).
- Recibir la Resolución de Autorización + el `sistemaCodigo`.

**Tiempo estimado**: 2-4 semanas de trámites + desarrollo.

---

## 3. Códigos clave (jerga SIAT)

| Código | Qué es | Vida útil | Quién lo genera |
|---|---|---|---|
| `CUIS` (Código Único de Inicio de Sistemas) | ID de sesión del SaaS por NIT | hasta que expire (~24h-meses) | SIN, vía `verificarComunicacion` + `siniciarSistema` |
| `CUFD` (Código Único de Facturación Diario) | Token para emitir en el día | 24h | SIN, vía `cufd` |
| `CUF` (Código Único de Factura) | ID único de cada factura | permanente | El emisor lo calcula determinísticamente |
| `CUFA` (Código Único de Facturación Anual) | Para casos especiales | 1 año | SIN (raro en computarizada) |

### Algoritmo del CUF (resumen)

```
CUF = NIT + fecha-emisión + sucursal + modalidad + tipoEmisión +
      tipoFactura + tipoDocumentoSector + numeroFactura + puntoVenta +
      verificador (Mod 11)
```

Es **determinista**: dos sistemas que generan el mismo CUF para la misma factura coinciden. Detalle exacto en RND vigente.

---

## 4. Endpoints SOAP

### Sandbox (pruebas)
- WSDL: `https://pilotosiatservicios.impuestos.gob.bo/v1/FacturacionPrueba?wsdl`
- URL operaciones: `https://pilotosiatservicios.impuestos.gob.bo/v1/...`

### Producción
- WSDL: `https://siatrest.impuestos.gob.bo/v1/FacturacionElectronica?wsdl` (verificar en doc oficial)
- URL operaciones: `https://siatrest.impuestos.gob.bo/v1/...`

### Servicios principales

| Servicio | Cuándo |
|---|---|
| `verificarComunicacion()` | Health check |
| `siniciarSistema()` → CUIS | Una vez al setup, o cuando expira |
| `cufd()` → CUFD del día | Cada 24h |
| `recepcionFactura(xml)` | Por cada factura (online individual) |
| `recepcionPaqueteFactura(zip)` | Para envío offline acumulado |
| `validacionRecepcionFactura(cuf)` | Verificar que SIN tiene la factura |
| `anulacionFactura(cuf, motivo)` | Anular dentro de las 96h hábiles |
| `recepcionEventoSignificativo(...)` | Reportar corte de servicio |
| `sincronizacionDatos()` | Sync de catálogos: actividades, productos SIN, unidades, leyendas |

---

## 5. Estructura del proyecto en Madriguera Shop

```
nibble/
├── prisma/
│   └── schema.prisma                  # Agregar campos SIAT al modelo Store
└── lib/billing/siat/
    ├── README.md                      # Resumen específico del módulo
    ├── config.ts                      # URLs sandbox/prod, modalidad, sistema
    ├── types.ts                       # Tipos: SiatCredentials, FacturaInput, FacturaResponse
    ├── client.ts                      # Cliente SOAP (envuelve `soap` o `node-soap`)
    ├── codes.ts                       # CUIS/CUFD cache + obtención
    ├── cuf.ts                         # Algoritmo CUF determinista
    ├── builder.ts                     # Construir XML de factura desde Order
    ├── sign.ts                        # XMLDSig (sólo si modalidad electrónica)
    ├── catalogs.ts                    # Cache de catálogos del SIN (productos, unidades)
    ├── sync.ts                        # Cron diario de sincronización
    ├── errors.ts                      # Mapeo de códigos de error SIN → user-friendly
    └── __tests__/                     # Fixtures + integration con sandbox
```

---

## 6. Cambios al schema Prisma

```prisma
// Agregar al modelo Store:
model Store {
  // ... campos existentes ...

  // ============== SIAT (facturación electrónica BO) ==============
  siatEnabled         Boolean @default(false)
  siatNit             String?
  siatRazonSocial     String?
  siatSucursalCodigo  Int     @default(0)  // 0 = casa matriz
  siatPuntoVentaCodigo Int    @default(0)
  siatTokenDelegado   String? @db.Text     // CIFRADO en producción
  siatModalidad       SiatModalidad @default(COMPUTARIZADA_EN_LINEA)
  siatActividadEconomica String? // código actividad
  siatLeyenda          String? @db.Text
}

enum SiatModalidad {
  COMPUTARIZADA_EN_LINEA
  ELECTRONICA_EN_LINEA
}

// Modelo de cache para CUIS/CUFD:
model SiatCode {
  id        String   @id @default(cuid())
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  type      String   // "CUIS" | "CUFD"
  code      String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([storeId, type, expiresAt])
}

// Snapshot de cada factura SIAT emitida:
model SiatInvoice {
  id            String   @id @default(cuid())
  orderId       String   @unique
  order         Order    @relation(fields: [orderId], references: [id])
  storeId       String

  cuf           String   @unique
  numeroFactura Int
  xmlPayload    String   @db.Text
  xmlResponse   String   @db.Text
  estado        String   // "VALIDA" | "ANULADA" | "RECHAZADA" | "OBSERVADA"
  codigoSiat    String?  // código de respuesta del SIN
  mensajeSiat   String?  @db.Text

  emitidaAt     DateTime @default(now())
  anuladaAt     DateTime?
  motivoAnulacion String?

  @@index([storeId, emitidaAt])
}
```

Y agregar relaciones en `Order`:
```prisma
model Order {
  // ...
  siatInvoice SiatInvoice?
}
```

---

## 7. Flujo de emisión paso a paso

```ts
// Pseudo-flow al crear un pedido confirmado
async function emitirFacturaSiat(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, store: true } });

  // 1. Verificar que la tienda tiene SIAT habilitado
  if (!order.store.siatEnabled || !order.store.siatTokenDelegado) {
    return; // skip — no emite factura
  }

  // 2. Obtener CUIS (cacheado)
  const cuis = await getOrRefreshCUIS(order.storeId);

  // 3. Obtener CUFD del día (cacheado por 24h)
  const cufd = await getOrRefreshCUFD(order.storeId, cuis);

  // 4. Generar siguiente número de factura (secuencial por sucursal+puntoVenta)
  const numeroFactura = await getNextNumeroFactura(order.storeId);

  // 5. Calcular CUF
  const cuf = computeCUF({
    nit: order.store.siatNit,
    fechaEmision: new Date(),
    sucursal: order.store.siatSucursalCodigo,
    modalidad: 1, // computarizada
    tipoEmision: 1, // online
    tipoFactura: 1, // venta sujeta a IVA
    tipoDocumentoSector: 1, // standard
    numeroFactura,
    puntoVenta: order.store.siatPuntoVentaCodigo,
  });

  // 6. Construir XML de la factura
  const xml = buildFacturaXml({
    cuf,
    cufd,
    numeroFactura,
    emisor: {
      nit: order.store.siatNit,
      razonSocial: order.store.siatRazonSocial,
      municipio: order.store.city,
    },
    cliente: {
      nombre: order.customerName,
      documento: order.customerDocumento ?? "0", // 0 = sin documento (consumidor final)
    },
    items: order.items,
    montoTotal: Number(order.total),
    leyenda: order.store.siatLeyenda,
  });

  // 7. (Si modalidad electrónica) firmar con XMLDSig
  // const xmlFirmado = await signXmlDsig(xml, certificadoEmisor);
  const xmlFirmado = xml; // computarizada no requiere XMLDSig

  // 8. Llamar al SIN
  const response = await siatClient.recepcionFactura({
    archivo: gzip(xmlFirmado).toString("base64"),
    cuis,
    cufd,
    nit: order.store.siatNit,
    cuf,
  });

  // 9. Guardar SiatInvoice según respuesta
  await db.siatInvoice.create({
    data: {
      orderId: order.id,
      storeId: order.storeId,
      cuf,
      numeroFactura,
      xmlPayload: xmlFirmado,
      xmlResponse: JSON.stringify(response),
      estado: response.codigoEstado === 908 ? "VALIDA" : "OBSERVADA",
      codigoSiat: String(response.codigoEstado),
      mensajeSiat: response.mensaje,
    },
  });

  // 10. Si está OBSERVADA, registrar en AuditLog para revisión manual
}
```

---

## 8. Manejo de errores SIN

| Código | Significado | Acción |
|---|---|---|
| 901 | Recepción exitosa | OK |
| 908 | Factura validada (estado final) | OK — guardar como VALIDA |
| 904 | CUFD inválido o expirado | Renovar CUFD y reintentar |
| 905 | XML mal formado | Bug nuestro — fail loud |
| 906 | NIT inválido | Bloquear emisión, alertar al merchant |
| 907 | Tipo factura incorrecto | Bug |
| 970+ | Errores de validación de campos | Detalle viene en `mensajesList` |

Strategia: para 904 (CUFD expirado), retry automático tras refresh. Para los demás, fail con el mensaje del SIN.

---

## 9. Sincronización de catálogos

El SIN expone listas de:
- **Productos SIN**: cada producto físico tiene un código SIN obligatorio (no es opcional). Mapeamos `Product` ↔ código SIN en una tabla aparte (`ProductSiatMapping`).
- **Unidades de medida**: kilo, litro, unidad, etc.
- **Actividades económicas**: código de actividad por NIT.
- **Mensajes/Leyendas**: textos legales que deben ir en la factura.
- **Tipos de documento**: CI, NIT, pasaporte.
- **Tipos de moneda**: BOB, USD, etc.

**Cron**: 1×/día llamando a `sincronizacionDatos()` para refrescar.

---

## 10. Eventos significativos (cortes de servicio)

Si el SIN está caído, podemos emitir **offline** y enviar después:
1. Antes del corte: registrar **evento significativo** ("inicio corte servicio").
2. Generar facturas localmente con CUF determinista — son válidas.
3. Cuando vuelve el servicio: registrar evento "fin corte" + enviar paquete acumulado vía `recepcionPaqueteFactura`.

---

## 11. Testing en sandbox

1. Pedir credenciales sandbox al SIN (SFVL Pilotaje).
2. Configurar `.env.local`:
   ```
   SIAT_MODE=sandbox
   SIAT_WSDL_URL=https://pilotosiatservicios.impuestos.gob.bo/v1/FacturacionPrueba?wsdl
   SIAT_SISTEMA_CODIGO=<asignado_por_SIN>
   ```
3. Crear un Store con NIT de pruebas (el SIN provee uno).
4. Ejecutar el flujo end-to-end → debe pasar la **Etapa de Pruebas** (SIN valida un set predefinido de casos).
5. Pasar a **Etapa de Producción Controlada** (1 mes con tráfico real limitado).
6. Pedir al SIN la **Resolución de Autorización** → producción full.

---

## 12. Dependencias Node recomendadas

```bash
npm install soap          # cliente SOAP
npm install xml-js        # parsing XML manual si hace falta
npm install xmlbuilder2   # construir XML
npm install xml-crypto    # XMLDSig (si modalidad electrónica)
npm install xsd-schema-validator  # validar contra XSD oficial
```

---

## 13. Bloqueadores conocidos

1. **Certificación SFVL**: no se puede emitir hasta tener el `sistemaCodigo`. Bloqueador legal de **2-4 semanas**.
2. **Cifrado del token delegado**: NO guardar plain. Usar `crypto.createCipheriv` con clave en env separada del `DATABASE_URL`.
3. **Sincronización de productos SIN**: cada producto del catálogo del merchant necesita un código SIN mapeado. UI obligatoria en `/dashboard/productos/[id]` para asignar este código.
4. **Backups del XML**: cada factura emitida debe persistirse 5 años (normativa tributaria).
5. **Anulación 96h hábiles**: después de eso, ya no se puede anular vía API — sólo nota de crédito/débito.

---

## 14. Cuándo NO emitir

- Tienda en `TRIAL`, `PAST_DUE`, `SUSPENDED` o `CANCELLED` → no emitir.
- `siatEnabled=false` → no emitir, mostrar como "recibo simple" en el orden.
- Pedido cancelado o efectivo no entregado → no emitir.
- Error verificable del NIT del cliente → emitir igual con NIT 0 (consumidor final).

---

## 15. Roadmap sugerido de implementación

### Fase A — Pre-trabajo legal (2-4 semanas, paralelo)
- [ ] Constituir Nibble S.R.L. + NIT activo
- [ ] Solicitar al SIN ser SFVL (Sistema de Facturación Virtual en Línea)
- [ ] Pasar Etapa de Pruebas (lote validado por SIN)
- [ ] Recibir `sistemaCodigo`

### Fase B — Schema + scaffolding (1 semana)
- [ ] Aplicar migration con campos SIAT en Store + modelos SiatCode/SiatInvoice
- [ ] Implementar `lib/billing/siat/config.ts` y `types.ts`
- [ ] Stub del cliente SOAP

### Fase C — Códigos + emisión (2 semanas)
- [ ] `getOrRefreshCUIS()` + `getOrRefreshCUFD()` con cache
- [ ] Algoritmo CUF determinista
- [ ] Builder XML de factura
- [ ] Validación contra XSD
- [ ] (Si modalidad electrónica) firma XMLDSig
- [ ] `emitirFacturaSiat(orderId)` integrado en `verifyPaymentAction` post-verificación

### Fase D — UI del merchant (1 semana)
- [ ] `/dashboard/facturacion/siat` para pegar token delegado
- [ ] Indicador en cada Order de si tiene factura SIAT emitida
- [ ] Botón "Anular" (96h hábiles) + nota de crédito (después)
- [ ] Mapeo Product ↔ código SIN

### Fase E — Operación (continuo)
- [ ] Cron de sincronización de catálogos
- [ ] Manejo de eventos significativos (cortes de servicio)
- [ ] Reporte de facturas emitidas por mes
- [ ] Endpoint de emisión de Libro de Compras y Ventas

---

## Referencias oficiales

- Portal SIAT: <https://siatinfo.impuestos.gob.bo>
- Anexo técnico: <https://siatanexo.impuestos.gob.bo>
- Implementación servicios: <https://siatanexo.impuestos.gob.bo/index.php/implementacion-servicios-facturacion>
- Recepción factura: <https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/implementacion-servicios-facturacion/facturacion-electronica/recepcion-factura-electronica>
- Firmado XML: <https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/firma-digital/firmado-de-xml>
- Asociación de sistemas: <https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/caracteristicas-sfvl/asociacion-de-sistemas>
- RND 102100000011 (PDF): <https://boliviaemprende.com/wp-content/uploads/2021/08/RND-102100000011.pdf>

---

## Cómo usar este skill como agente

Si el usuario te pide:
- **"Implementá la primera factura SIAT"** → arranca por Fase B + C, asume sandbox.
- **"Agregá UI para que el merchant pegue su token"** → ir a `/dashboard/facturacion/siat`, encriptación con `crypto.createCipheriv`.
- **"Anulá la factura X"** → checá si pasaron <96h hábiles, después llamar `anulacionFactura` con motivo.
- **"Por qué falla el envío"** → el código de respuesta del SIN tiene la pista. Mira la tabla §8.
- **"Sincronizá catálogos"** → endpoint `sincronizacionDatos()`, tabla 9.

**Si el usuario aún no constituyó S.R.L. ni tramitó SFVL**, no se puede emitir nada. Hacé esa pregunta primero.
