# Aviso de estado de cobranza en el dashboard del dueño

**Fecha:** 2026-07-08
**Estado:** Aprobado (diseño)

## Problema

Cuando una tienda entra en mora o es suspendida por falta de pago, el dueño
solo se entera por email (`storeSuspendedEmail`, recordatorios de factura). No
hay ningún aviso **in-app** en su dashboard. Un dueño que no revisa el email
puede quedar suspendido sin saberlo, o dejar vencer una factura sin registrar
el aviso.

Objetivo: avisar en el dashboard cuando la tienda está suspendida y también
antes del vencimiento, para que el dueño lo lea y regularice.

## Contexto del código existente

- Un dueño de tienda **suspendida sí puede entrar** al dashboard: los guards
  (`requireStoreOwner`, `requireOwnerOnly`) no filtran por `status`. Así que el
  aviso tiene dónde mostrarse.
- Ya hay patrón de avisos: `PlanLimitsBanner` (banner en la home) e
  `ImpersonationBanner` (banner a nivel *layout*, visible en todas las páginas
  del dashboard, arriba del contenido).
- Datos disponibles sin cambios de schema: `Store.status`
  (`ACTIVE`/`PAST_DUE`/`SUSPENDED`/…), `Store.suspendedReason`, e
  `Invoice.dueDate` + `Invoice.status` (`PENDING`/`OVERDUE`/`PAID`).
- El email de recordatorios (`lib/billing/sendReminders.ts`) ya usa la cadencia
  3 días / 1 día / día D / vencida, con `daysUntilDue = ceil((dueDate−now)/día)`
  en hora Bolivia. El aviso in-app espeja esa misma lógica.

## Diseño

### 1. Detección de estado — lógica pura

Nuevo módulo `lib/billing/dunning-notice.ts` con una función pura:

```ts
export type DunningLevel = "suspended" | "overdue" | "due_today" | "due_soon";

export type DunningNotice = {
  level: DunningLevel;
  /** Días hasta el vencimiento (solo para due_soon/due_today; negativo si venció). */
  daysUntilDue: number | null;
} | null;

export function computeDunningNotice(input: {
  status: StoreStatus;
  earliestOpenInvoice: { dueDate: Date; status: InvoiceStatus } | null;
  now: Date;
}): DunningNotice;
```

**Prioridad** (se devuelve el primero que aplique):

1. `suspended` — `status === "SUSPENDED"`.
2. `overdue` — `status === "PAST_DUE"` **o** la factura abierta más próxima ya
   venció (`daysUntilDue < 0`). La segunda condición cubre el hueco cuando una
   factura venció pero el cron `syncStoreStatuses` todavía no marcó la tienda
   como `PAST_DUE`.
3. `due_today` — factura abierta con `daysUntilDue === 0`.
4. `due_soon` — factura abierta con `1 <= daysUntilDue <= 3`.
5. `null` — nada que avisar (al día, o sin factura próxima).

`daysUntilDue` se calcula en hora Bolivia, igual que `sendReminders`
(`Math.ceil((dueDate.getTime() − now.getTime()) / DAY_MS)`).

La función es pura → **unit-testeable** (encaja con la cultura de cobertura del
repo).

### 2. Carga de datos — server

En `app/dashboard/layout.tsx` (que ya carga `store`), se agrega una query: la
factura abierta más próxima de la tienda.

```ts
const earliestOpenInvoice = await db.invoice.findFirst({
  where: { storeId: store.id, status: { in: ["PENDING", "OVERDUE"] } },
  orderBy: { dueDate: "asc" },
  select: { dueDate: true, status: true },
});
const notice = computeDunningNotice({
  status: store.status,
  earliestOpenInvoice,
  now: new Date(),
});
```

El `notice` (serializable) se pasa al client component.

### 3. UI — `components/dashboard/BillingNotice.tsx` (client)

Recibe `notice: DunningNotice` y renderiza:

**Banner** — arriba del contenido, en todas las páginas del dashboard (mismo
lugar que `ImpersonationBanner`, dentro de `dashboard/layout.tsx`):

- `suspended` / `overdue` → **rojo, NO se cierra** (persiste hasta regularizar).
- `due_today` / `due_soon` → **ámbar, se puede cerrar** por sesión.

**Modal (una vez por sesión)** — **solo** para `suspended` y `overdue` (los
estados urgentes que requieren acción). Los "por vencer" muestran solo el
banner (no molestamos al que va a tiempo). Si sigue suspendido, el modal
reaparece en la próxima sesión del navegador.

**Tracking sin DB** — vía `sessionStorage`:

- Modal visto: clave `billing-notice-modal-seen:<level>` (por sesión de browser).
- Banner cerrado: clave `billing-notice-dismissed:<level>:<dueDateISO>` (solo
  para los estados dismissibles). La `dueDate` en la clave hace que un nuevo
  ciclo (nueva factura) vuelva a mostrar el aviso.

**CTA** en todos: **"Ver facturación"** → `/dashboard/facturacion`.

### 4. Copy (español, genérico — es billing de la tienda)

| Nivel | Título | Cuerpo | Color |
|---|---|---|---|
| `suspended` | Tu tienda está suspendida | No está visible para tus clientes hasta que regularices el pago. | rojo |
| `overdue` | Tenés una factura vencida | Regularizá el pago antes de que se suspenda tu tienda. | rojo |
| `due_today` | Tu factura vence hoy | Pagá hoy para mantener tu tienda activa. | ámbar |
| `due_soon` | Tu factura vence en N días | Pagá con tiempo para evitar inconvenientes. | ámbar |

### 5. Alcance — lo que NO hace

- Es **solo un aviso**. No bloquea ni restringe funciones del dashboard; hoy el
  dueño suspendido puede operar y eso no cambia.
- El storefront público ya oculta la tienda suspendida por otra vía
  (`getStorefrontData`), fuera del alcance de esta feature.
- Sin cambios de schema, sin nuevas migraciones, sin escrituras a DB.

## Testing

- **Unit** — `computeDunningNotice`: cada nivel, la prioridad entre ellos, los
  bordes de `daysUntilDue` (3 → due_soon, 4 → null, 0 → due_today, negativo con
  status PAST_DUE → overdue), y `status SUSPENDED` gana sobre cualquier factura.
- **Verificación en navegador** — con una tienda suspendida en la DB local:
  entrar al dashboard como dueño, ver el modal (1ª vez) + el banner rojo
  persistente; confirmar el CTA a `/dashboard/facturacion`.

## Archivos

- `lib/billing/dunning-notice.ts` — nuevo (lógica pura).
- `components/dashboard/BillingNotice.tsx` — nuevo (client: banner + modal).
- `app/dashboard/layout.tsx` — editar (query + render del componente).
- `tests/unit/billing/dunning-notice.test.ts` — nuevo.
