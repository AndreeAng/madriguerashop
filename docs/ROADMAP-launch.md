# 🚀 Roadmap a producción — Madriguera Shop

> **Estado**: aplicación funcionalmente completa para Fase 1. Schema, auth, onboarding, catálogo, pedidos, billing, emails, recordatorios, AuditLog, rate limit y observabilidad: todo implementado y conectado a DB. Sólo bloquean trámites externos (S.R.L., dominio, SMTP, QR del SaaS).
>
> **Objetivo**: que un cliente pueda **registrarse, configurar su tienda, recibir pedidos por WhatsApp, cobrar por QR estático y que vos emitas su factura mensual** sin tocar código.
>
> **Última actualización**: 2026-05-06
> **Producto**: Madriguera Shop · operado por Nibble S.R.L.
> **Dominio**: `madrigueras.shop`

---

## 📊 Estado actual

### ✅ Implementado (Fase 1 cerrada)

#### Core / multi-tenant
- Schema Prisma de 22 modelos + migración inicial versionada (`prisma/migrations/20260506000000_init/`)
- Auth con NextAuth v5 (email o teléfono, JWT, 4 roles, middleware con `authorized`)
- 5 tiendas demo seeded (RESTAURANT, FOOD_TRUCK, RETAIL, HARDWARE, SERVICES) — todas navegables públicamente

#### Onboarding y settings
- Registro público `/registro` con auto-login
- **Sin período de prueba**: la primera factura se emite al registrar
- Settings de tienda con 5 secciones (branding, pagos, delivery, horarios, SEO)
- Subida real de imágenes con magic-byte validation + sharp + WebP

#### Catálogo
- CRUD de categorías con jerarquía 2 niveles
- CRUD de productos con variantes, imágenes múltiples, stock, badges
- **Disponibilidad por horario** (combos del almuerzo, especiales del finde)
- Mapeo Product ↔ código SIN preparado para SIAT

#### Storefront público
- SSR con Prisma + adapter pattern
- SEO completo (meta, Open Graph, sitemap dinámico, robots.txt)
- PWA manifest para install en mobile
- Tracking de PageView server-side con cookies guest+session
- 404 específico para tiendas inexistentes

#### Pedidos end-to-end
- Carrito con guest token (7d TTL)
- Checkout: delivery/pickup, zonas, QR/efectivo, comprobante upload, cupones, notas
- Server action `createOrder` con recálculo total server-side, transacción atómica, generación de trackingToken
- Tracking público con timeline de eventos + revalidate 30s
- Gestión de pedidos del owner (state machine validada, verify/reject pago)
- Mensaje de WhatsApp pre-armado al confirmar

#### Billing manual del SaaS
- Cron `/api/cron/billing` con auth bearer
- Emisión automática + sync de estados (PENDING → OVERDUE → PAST_DUE → SUSPENDED)
- Reactivación automática al pagar
- Recordatorios por email: 3d antes / 1d antes / día / cada 3d post-vencimiento (con cap de 5 e idempotencia)
- Owner uploads comprobante; admin verifica → owner recibe confirmación
- Email de tienda suspendida cuando aplica

#### Email transaccional (Brevo recomendado)
- Welcome (al registrarse)
- Recovery con token 1h
- Invoice issued / paid / reminder / suspended
- Order created (al owner)
- Payment verified / rejected (al cliente)

#### Admin del SaaS
- Dashboard con KPIs reales (tiendas activas, MRR cobrado, GMV, top tiendas)
- `/admin/tiendas` con filtros + búsqueda
- `/admin/cobranzas` con verificación de comprobantes
- `/admin/auditoria` con viewer del AuditLog filtrado por categoría

#### Hardening (Fase 1.7 cerrada)
- Validación Zod en todos los server actions
- Rate limit (login, registro, recovery, checkout, uploads)
- AuditLog en acciones sensibles
- Sentry SDK con shim activable por `SENTRY_DSN`
- Health check `/api/health` con DB ping
- Honeypot anti-bot en registro
- Validación Origin en endpoints públicos
- CSP headers básicos en `vercel.json`

#### Tests + CI
- Vitest configurado con tests unit (slug, cuf)
- Playwright con E2E del happy path
- GitHub Actions: lint + typecheck + tests + build en cada PR

#### Páginas legales
- `/terminos` y `/privacidad` redactados (placeholders para datos legales reales)

#### Skill SIAT Bolivia
- `.claude/skills/siat-bolivia/SKILL.md` — guía completa para implementar facturación electrónica
- Scaffolds en `lib/billing/siat/` (config, types, client, codes, cuf, builder, errors)

---

## 🟡 Bloqueadores externos (no son código)

| # | Bloqueador | Tiempo estimado |
|---|---|---|
| 1 | Constituir **Nibble S.R.L.** + obtener NIT | 2-3 semanas (abogado/contador) |
| 2 | Comprar dominio `madrigueras.shop` | 5 min |
| 3 | Contratar VPS (DigitalOcean/Hetzner/Contabo) | 1 hora |
| 4 | Subir QR del SaaS + setear `SAAS_PAYMENT_QR_URL` | 5 min post-NIT |
| 5 | Crear cuenta Brevo + verificar dominio | 30 min |
| 6 | Setear `NEXTAUTH_SECRET`, `CRON_SECRET` reales | 2 min |
| 7 | Confirmar pricing definitivo (ahora Bs 500/mes y Bs 1.200/mes) | Decisión |
| 8 | Llenar datos legales en `/terminos` y `/privacidad` | 30 min post-S.R.L. |
| 9 | Tramitar SFVL ante el SIN (para facturación electrónica) | 2-3 meses |

---

## 🟢 Phase 2 (post-launch, según haya tracción)

- **Multi-staff**: el rol `CASHIER` existe pero sin UI de invitación
- **Banners y popups gestionables** desde `/dashboard/marketing`
- **Plan limits enforcement** (`maxProducts`, `maxOrdersPerMonth`, `maxStaff`)
- **Custom domains** del owner (`tienda.com` además de `madrigueras.shop/su-slug`)
- **QR dinámico** (Banco Económico/BCP API si está disponible)
- **Multi-branch**: una tienda con varias sucursales
- **AI Chatbot por tienda** (modelo `AiChatSession` ya existe)
- **App móvil Expo** para owners
- **Marketplace** `madrigueras.shop/explorar` con búsqueda cross-tienda
- **Reportes contables** exportables (CSV/Excel)
- **Service worker** para PWA offline-read

---

## 📋 Setup en otra computadora

```bash
git clone <repo>
cd madrigueras/nibble
cp .env.example .env
# Llenar: DATABASE_URL, NEXTAUTH_SECRET (openssl rand -base64 32),
#         APP_URL, NEXTAUTH_URL, SEED_SUPER_ADMIN_EMAIL/PASSWORD
npm install
npm run db:generate
npm run db:deploy        # primera vez en prod (no db:push)
npm run db:seed          # opcional, para tener tiendas demo
npm run dev
```

---

## 🎯 Hoja de ruta del lanzamiento

**Día 1 (vos)** — decisiones rápidas:
- Comprar dominio
- Decidir hosting (VPS recomendado)
- Confirmar pricing

**Día 2-3 (vos + abogado)** — entidad legal:
- Iniciar trámite S.R.L.
- Mientras tanto, crear cuenta Brevo

**Semana 2-3** — infra:
- Contratar VPS, setup nginx + systemd
- Domain DNS apuntado
- SMTP funcionando
- Subir QR
- Sentry configurado

**Semana 3-4** — primer cliente real:
- Demo a un dueño (ej. una pizzería conocida)
- Onboarding manual asistido
- Iterar feedback

**Mes 2-3 (paralelo)** — facturación electrónica:
- Tramitar SFVL ante SIN
- Implementar siguiendo el SKILL.md
- Pasar etapas de prueba

**Mes 4+** — escala:
- Phase 2 features según demanda
- Marketing + crecimiento
