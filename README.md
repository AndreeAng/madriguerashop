# Madriguera Shop

> Plataforma SaaS de tiendas virtuales multi-tenant para Bolivia. Cobra por QR del banco, recibe pedidos por WhatsApp, opera todo desde un panel.
>
> Una empresa **Nibble S.R.L.** · Cochabamba, Bolivia.

**Stack**: Next.js 15 (App Router) · Prisma · NextAuth v5 · Tailwind CSS 4 · TypeScript · PostgreSQL

---

## Estructura

```
.
├── nibble/                     # Aplicación Next.js
│   ├── app/                    # App Router: rutas, layouts, server actions, API
│   ├── components/             # Componentes React (admin, dashboard, marketing, storefront)
│   ├── lib/                    # Auth, billing, email, storage, observability, etc.
│   ├── server/actions/         # Server Actions de mutación
│   ├── prisma/                 # Schema, migrations, seed
│   ├── tests/                  # Unit (vitest) + E2E (Playwright)
│   └── infra/                  # nginx config + scripts de deploy
├── docs/
│   ├── SRS-saas-tienda-virtual.md
│   ├── ROADMAP-launch.md       # Estado y plan
│   └── design/
├── .claude/skills/             # Skills para agentes (incluye SIAT Bolivia)
├── .github/                    # CI/CD, dependabot, templates, CODEOWNERS
│   ├── workflows/
│   │   ├── ci.yml              # Lint + typecheck + unit + e2e + migrations + build + audit
│   │   ├── codeql.yml          # Análisis estático de seguridad (semanal + por PR)
│   │   ├── dependency-review.yml  # Bloquea PRs con CVEs nuevas en deps
│   │   └── deploy.yml          # Migrations + deploy a Vercel + smoke test
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   └── dependabot.yml          # Updates semanales agrupados
├── .husky/                     # Pre-commit hooks (lint-staged + commitlint)
└── SECURITY.md                 # Canal de reporte de vulnerabilidades
```

---

## Desarrollo local

```bash
cd nibble
cp .env.example .env            # Configurá DATABASE_URL y NEXTAUTH_SECRET mínimo
npm install
npm run db:generate
npm run db:push                 # primera vez: crea tablas
npm run db:seed                 # 5 tiendas demo + super admin + plans
npm run dev
```

App en `http://localhost:3000`. Login del super admin con las credenciales de `SEED_SUPER_ADMIN_EMAIL`/`PASSWORD` que pusiste en `.env`.

### Logins de prueba (post-seed)

Password universal: `owner123change`

| Tienda | URL | Login owner |
|---|---|---|
| Big Bite Wings (RESTAURANT) | `/big-bite-wings` | `owner@bigbitewings.bo` |
| La Latita (FOOD_TRUCK) | `/la-latita` | `owner@lalatita.bo` |
| Nutriarte (RETAIL) | `/nutriarte` | `owner@nutriarte.bo` |
| Ferretería Tunari (HARDWARE) | `/ferreteria-tunari` | `owner@ferreteriatunari.bo` |
| Estudio Clara (SERVICES) | `/estudio-clara` | `owner@estudioclara.bo` |

---

## Variables de entorno

Mirá `nibble/.env.example` para la lista completa.

**Críticas para correr en local**:
- `DATABASE_URL` — Postgres
- `AUTH_SECRET` — `openssl rand -base64 32`
- `ENCRYPTION_KEY` — `openssl rand -base64 32` (separada de AUTH_SECRET)
- `APP_URL`, `AUTH_URL` — `http://localhost:3000` en dev

**Para producción además**:
- `CRON_SECRET` — para `/api/cron/billing`
- `PROOF_UPLOAD_DIR` — path fuera de `public/` para comprobantes
- `SMTP_*` — Brevo recomendado (300/día gratis)
- `SAAS_PAYMENT_QR_URL` — tu QR estático del banco
- `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` — observability
- `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS` — sino los docs legales muestran banner "borrador"
- `UPLOAD_DIR`, `PUBLIC_UPLOADS_URL` — si servís uploads desde otro path

---

## CI/CD

El pipeline corre en GitHub Actions con 7 jobs en paralelo/secuencia:

| Job | Qué hace | Bloquea merge si falla |
|---|---|---|
| **Lint + Typecheck** | ESLint + `tsc --noEmit` | ✅ |
| **Unit tests** | Vitest (sin DB) | ✅ |
| **Migrations validate** | Aplica migrations a Postgres limpio + chequea drift contra schema.prisma + corre seed | ✅ |
| **E2E tests** | Playwright contra app + DB reales, con cache de browsers | ✅ |
| **Build** | `next build` con cache `.next/cache` + reporte de bundle size | ✅ |
| **npm audit** | Vulnerabilidades high+ en deps de producción | ✅ |
| **Dependency review** | Bloquea PRs que agregan CVEs o licencias prohibidas (GPL/AGPL) | ✅ |
| **CodeQL** | Análisis estático de seguridad y calidad (semanal + por PR) | ⚠ alerts |

Deploy a Vercel se dispara automáticamente cuando CI verde en `main`:
1. Aplica `prisma migrate deploy` a la DB de producción (con `PROD_DATABASE_URL`).
2. `vercel build && vercel deploy --prod`.
3. Smoke test contra `/api/health` con backoff exponencial.
4. Si el smoke falla, Vercel mantiene el deploy anterior live (rollback automático).

### Pre-commit hooks

Husky + lint-staged + commitlint corren localmente antes de cada commit:

- **lint-staged**: ESLint --fix sobre archivos staged + `prisma format` sobre schema.
- **commitlint**: enforce de [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `chore`, etc.).

Setup automático tras `npm install`. Para emergencias: `git commit --no-verify` (NO usar para PRs).

### Branch protection

Ver [`docs/branch-protection.md`](docs/branch-protection.md) para la configuración recomendada de protección de `main` en GitHub.

### Secrets requeridos en el repo

| Secret | Para qué |
|---|---|
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Deploy |
| `PROD_DATABASE_URL` | Migrations en deploy |
| `PROD_APP_URL` | Smoke test post-deploy |

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint flat config |
| `npm run typecheck` | TypeScript sin emit |
| `npm run test` | Unit tests (vitest) |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run db:generate` | Genera Prisma client |
| `npm run db:migrate` | Aplica migración en dev |
| `npm run db:deploy` | Aplica migraciones en prod |
| `npm run db:push` | Sync schema sin migration (sólo dev) |
| `npm run db:studio` | UI de Prisma Studio |
| `npm run db:seed` | Pobla con datos de prueba |

---

## Cron jobs

`/api/cron/billing` corre 1×/día y hace:
1. **Emisión** de invoices con `nextInvoiceAt <= now`
2. **Sync** de estados: PENDING vencidas → OVERDUE; tiendas con OVERDUE → PAST_DUE; con grace excedido → SUSPENDED; reactivar las que pagaron
3. **Recordatorios** por email: 3 días antes, 1 día antes, día de vencimiento, cada 3 días después de vencer

**Auth**: header `Authorization: Bearer $CRON_SECRET`

**Setup en Vercel**: ya configurado en `nibble/vercel.json`.

**Setup en VPS**:
```bash
0 6 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://madrigueras.shop/api/cron/billing
```

---

## Deploy

### Vercel
- `vercel.json` ya configurado con cron + headers de seguridad.
- Conectá el repo, setea env vars, listo.

### VPS (recomendado para Bolivia, ~$12/mes)
- Ver `nibble/infra/nginx/nibble.conf.example`
- `nibble/infra/scripts/deploy.sh.example`
- `nibble/infra/scripts/nibble.service.example` (systemd)

Migraciones en producción:
```bash
npm run db:deploy   # NO db:push en producción
```

---

## Facturación electrónica SIAT (Bolivia)

Soporte para SIAT (Servicio de Impuestos Nacionales) está **planeado**, no implementado todavía. Hay scaffolds en `nibble/lib/billing/siat/` y una guía completa en `.claude/skills/siat-bolivia/SKILL.md`.

Bloqueadores:
1. Constituir Nibble S.R.L. + NIT activo
2. Tramitar SFVL ante el SIN
3. Pasar Etapa de Pruebas + Producción Controlada

Tiempo estimado total: 2-3 meses desde el momento que arranquen los trámites.

---

## Documentación

- **`docs/SRS-saas-tienda-virtual.md`** — Spec original del producto
- **`docs/ROADMAP-launch.md`** — Estado y plan a producción
- **`.claude/skills/siat-bolivia/SKILL.md`** — Guía técnica de facturación electrónica BO
- **`nibble/lib/billing/siat/README.md`** — Estado del módulo SIAT en código

---

## Soporte

Issues: en este repo. Para temas comerciales: hola@madrigueras.shop · WhatsApp +591 7220 1700.

© 2026 Madriguera Shop · Operado por Nibble (Bolivia).
