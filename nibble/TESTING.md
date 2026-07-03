# Testing

La suite tiene tres niveles, todos corren en CI (`.github/workflows/ci.yml`)
en cada push y PR a `main`. El gate agregado `ci-success` es el check que
protege la branch.

| Nivel | Runner | DB | Comando | Qué cubre |
|-------|--------|----|---------|-----------|
| **Unit** | Vitest | — | `npm run test` | Lógica pura: precios del checkout, cupones, identifiers, export CSV, billing, availability, SIAT/CUF, slug, rate limit |
| **Integración** | Vitest | Postgres real | `npm run test:integration` | Invariantes que necesitan DB: ciclo de facturación, transiciones de estado de tienda, row-lock de cupones (TOCTOU) |
| **E2E** | Playwright | Postgres real + app | `npm run test:e2e` | Flujos reales en browser: storefront, registro, login, **checkout completo** |

## Correr local

### Unit (rápido, sin setup)

```bash
npm run test            # una vez
npm run test:watch      # modo watch
```

### Integración (necesita Postgres)

Los tests de integración corren contra una DB Postgres real vía la env var
`TEST_DATABASE_URL`. **Nunca** apuntes a tu DB de desarrollo — los tests
crean y borran datos (usan prefijos `test-` + cleanup, pero mejor aislar).

**Opción A — Postgres local (Docker):**

```bash
# 1. Crear una DB de test separada en tu contenedor Postgres
docker exec <tu-contenedor-pg> psql -U postgres -c "CREATE DATABASE nibble_test;"

# 2. Apuntar TEST_DATABASE_URL a esa DB (misma password que tu DATABASE_URL)
export TEST_DATABASE_URL='postgresql://postgres:PASSWORD@localhost:5434/nibble_test?schema=public'

# 3. Aplicar migraciones + seed base (templates, plans, SaasSettings)
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
DATABASE_URL=$TEST_DATABASE_URL \
  SEED_SUPER_ADMIN_EMAIL=test@example.com \
  SEED_SUPER_ADMIN_PASSWORD=test-password-not-real-12345 \
  npm run db:seed

# 4. Correr
npm run test:integration
```

**Opción B — Neon branch:** copiar el connection string *pooled* de una
branch dedicada de Neon a `TEST_DATABASE_URL` y correr los pasos 3-4.

### E2E (Playwright)

Con el dev server ya levantado (`npm run dev`), Playwright lo reusa:

```bash
npx playwright test --project=chromium
```

En CI, Playwright buildea y levanta la app él mismo contra un Postgres
efímero (ver el job `test-e2e`).

## CI: setup del secret de integración

El job `test-integration` del workflow corre contra una **branch dedicada de
Neon** vía el secret `TEST_DATABASE_URL`. Setup one-time:

1. En el dashboard de Neon: **Branches → Create Branch** (nombrarla `ci-test`).
2. Copiar el connection string **pooled** de esa branch.
3. En GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, nombre `TEST_DATABASE_URL`, valor = el connection string.
4. **Seed one-time de la branch** (los tests necesitan Plan/Template/
   SaasSettings/BillingCounter base):

   ```bash
   DATABASE_URL='<pooled-url-de-la-branch>' npx prisma migrate deploy
   DATABASE_URL='<pooled-url-de-la-branch>' \
     SEED_SUPER_ADMIN_EMAIL=ci@example.com \
     SEED_SUPER_ADMIN_PASSWORD=ci-password-not-real-12345 \
     npm run db:seed
   ```

5. De ahí en más el workflow aplica `prisma migrate deploy` a la branch antes
   de cada run (idempotente); el seed base persiste, no hace falta repetirlo.

Sin el secret, el job falla con un mensaje claro desde
`tests/integration/setup.ts`.

## Flujo manual completo (no corre en CI)

Suite Playwright aparte que recorre la app entera como un humano contra el
server local: superadmin crea una tienda de test → el owner la configura
completa (horarios nocturnos, delivery, QR, categorías, productos, banner,
popup, cupones) → un cliente hace 5 pedidos con todas las variantes
(delivery/pickup, efectivo/QR con comprobante, con/sin cupón, programado)
verificando montos exactos → el owner verifica el pago QR.

```bash
# 1. App corriendo en :3000 (build de producción recomendado)
RATE_LIMIT_ALLOW_IN_MEMORY=true npm run build && npm run start

# 2. Generar la imagen de prueba para uploads (una vez)
node tests/manual/make-img.mjs

# 3. Correr el flujo (~3 min; screenshots en tests/manual/shots/)
npx playwright test -c playwright.manual.config.ts

# 4. Limpiar las tiendas kiosko-test-* que cada corrida deja en la DB local
node tests/manual/cleanup-test-stores.mjs
```

Cada corrida crea una tienda con slug único (`kiosko-test-<sufijo>`) a
propósito, para que las corridas no colisionen — por eso existe el cleanup.

## Estructura

```
tests/
  unit/           # *.test.ts — Vitest, sin DB
    orders/pricing.test.ts     # el camino del dinero
    ...
  integration/    # *.test.ts — Vitest contra Postgres real
    billing.test.ts
    coupon-toctou.test.ts
    setup.ts      # valida TEST_DATABASE_URL
  e2e/            # *.spec.ts — Playwright (CI)
    checkout.spec.ts           # incluye checkout con cupón WINGS10
    storefront.spec.ts
    dashboard.spec.ts
  manual/         # *.spec.ts — Playwright (solo local, config propia)
    flujo-completo.spec.ts     # superadmin → tienda entera → 5 pedidos
    cleanup-test-stores.mjs
```
