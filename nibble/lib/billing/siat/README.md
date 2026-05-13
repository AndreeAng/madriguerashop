# SIAT (Bolivia) — Módulo de facturación electrónica

> Para la guía completa consultá `.claude/skills/siat-bolivia/SKILL.md` en la raíz del repo.
>
> Este README cubre lo específico del módulo Node.js.

## Estado actual

🟡 **Scaffolding** — los archivos definen la API pública pero NO emiten facturas reales todavía. La activación requiere:

1. Que Nibble S.R.L. esté certificada por el SIN como SFVL (Sistema de Facturación Virtual en Línea).
2. Que se aplique la migración de Prisma con los campos `siat*` en Store + modelos `SiatCode` + `SiatInvoice`.
3. Que se instalen las deps de SOAP/XML (`npm install soap xmlbuilder2 xml-crypto`).
4. Que se llene `.env` con `SIAT_SISTEMA_CODIGO` y URLs.

## Estructura

```
lib/billing/siat/
├── README.md          ← este archivo
├── config.ts          ← URLs sandbox/prod, modalidades, sistema
├── types.ts           ← Tipos: SiatCredentials, FacturaInput, etc.
├── client.ts          ← Cliente SOAP (stub)
├── codes.ts           ← CUIS/CUFD cache + obtención
├── cuf.ts             ← Algoritmo CUF determinista
├── builder.ts         ← Construir XML de factura desde Order
├── sign.ts            ← XMLDSig (sólo si modalidad electrónica)
├── catalogs.ts        ← Cache de catálogos SIN (productos, unidades)
└── errors.ts          ← Mapeo de códigos error SIN → mensajes
```

## Por qué stub y no implementación completa

Implementar SIAT sin tener:
- El `sistemaCodigo` real del SIN
- Un NIT de pruebas
- Acceso al sandbox `pilotosiatservicios`

Es escribir código contra una documentación. Mejor dejar la API pública definida (tipos + funciones con TODOs) y completar cuando tengamos las credenciales reales.

## Cómo activar (cuando llegue el momento)

1. `npm install soap xmlbuilder2 xml-crypto xsd-schema-validator`
2. Migrar el schema (campos `siat*` + `SiatCode` + `SiatInvoice`)
3. Llenar las funciones marcadas `// TODO` con la implementación real
4. Tests: en `__tests__/`, agregar un set de fixtures con respuestas reales del sandbox
5. Conectar `emitirFacturaSiat(orderId)` desde `server/actions/order-management.ts` justo después de `verifyPaymentAction` exitoso
