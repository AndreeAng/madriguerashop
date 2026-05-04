# 🚀 Roadmap a producción — `madriguerashop`

> **Estado**: prototipo navegable con maquetas reales conectadas a mocks. Schema de Prisma completo y server actions del **carrito** ya tocan DB. Falta cerrar el bucle: catálogo editable, pedidos reales, pagos verificables, billing, infra y observabilidad.
>
> **Objetivo**: que un cliente pueda **registrarse, configurar su tienda, recibir pedidos por WhatsApp, cobrar el QR estático y que tú emitas su factura mensual** sin tocar código.
>
> **Última actualización**: 2026-05-04
> **Repo**: https://github.com/AndreeAng/madriguerashop

---

## 📊 Estado actual (auditoría rápida)

### ✅ Lo que ya está hecho

| Área | Estado | Notas |
|---|---|---|
| Schema Prisma completo | ✅ | 22 modelos: Users, Stores, Products, Orders, Carts, Coupons, Plans, Invoices, AuditLog, AI chat, etc. Source of truth: `nibble/prisma/schema.prisma` |
| Auth (NextAuth v5 + Credentials) | ✅ | Login con email **o** teléfono, JWT, roles `SUPER_ADMIN / STORE_OWNER / CASHIER / CUSTOMER`, middleware con `authorized` callback |
| Server actions del carrito | ✅ | `addItemToCart`, `updateCartItemQuantity`, `removeCartItem`, `getCartSnapshot`, `clearCart` con guest-token + cookies |
| Storefront público (`/[slug]`) | ✅ UI | Hero, menú por categorías, quick view, footer — pero lee de **mocks** (`lib/mock/products.ts`) |
| Páginas marketing (`/`, `/tiendas`) | ✅ | Landing del SaaS y directorio público |
| Login + recovery (UI) | ✅ | `app/(auth)/login`, `app/(auth)/recovery` — recovery sin server action |
| Dashboard del owner (UI) | 🟡 | `/dashboard` — totalmente mockeado, sin queries reales |
| Admin del SaaS (UI) | 🟡 | `/admin` — mockeado |
| Checkout (UI) | 🟡 | `/[slug]/checkout` — UI completa, sin server action que cree el pedido |
| Página de orden (UI) | 🟡 | `/[slug]/orden/[token]` — sin lectura real |
| Seed inicial | 🟡 | Templates + Plans + super admin + tienda demo (parcial — verificar contra el archivo) |

### ❌ Lo que falta (lo importante)

Carpetas creadas pero **vacías**: `lib/billing/`, `lib/email/`, `lib/notifications/`, `lib/storage/`, `lib/analytics/`, `lib/i18n/`, `tests/unit/`, `tests/e2e/`. Hay un `app/api/cron/` y `app/api/health/` también vacíos.

---

## 🎯 Plan por fases

> **Filosofía**: cada fase termina en algo *demostrable a un cliente*. No avances a la siguiente sin cerrar la actual.

---

### 🟥 Fase 1 — MVP cobrable (4–6 semanas)

**Meta**: un cliente paga el plan, abre su tienda, sube productos, recibe pedidos por WhatsApp y verifica pagos QR.

#### 1.1 — Onboarding y gestión de la tienda *(la cara que ve el cliente)*

- [ ] **Registro público de tienda** — `/registro` o flujo desde landing
  - Form: nombre tienda, slug (validar único), vertical, WhatsApp, ciudad, email/teléfono del owner, contraseña
  - Crea `Store` (status=`TRIAL`, `trialEndsAt = now() + 14d`) + `User` (role=`STORE_OWNER`) + asigna `Plan` por defecto + asigna `Template` por vertical
  - Server action: `server/actions/onboarding.ts` → `registerStore()`
- [ ] **Settings de la tienda** — `/dashboard/settings`
  - Branding: logo, banner, favicon, colores (`primaryColor/secondaryColor/accentColor`), fuente, dark mode
  - Contacto: WhatsApp, email, dirección, ciudad, lat/lng, redes
  - Pagos: subir `qrImageUrl`, `qrInstructions`, toggles `acceptsCashOnDelivery / acceptsQR`
  - Delivery: `deliveryEnabled`, `pickupEnabled`, `defaultDeliveryFee`, `freeDeliveryAbove`
  - Horarios: 7 filas de `StoreHours`
  - SEO: `metaTitle`, `metaDescription`, `ogImageUrl`
- [ ] **Storefront público real** — refactor `app/[slug]/page.tsx`
  - Reemplazar `getStore()` y `getProductsByStore()` mock por queries reales (`lib/tenant/resolve.ts` ya tiene base)
  - SSR + revalidación por tag (`revalidateTag(`store:${slug}`)`)
  - 404 si `store.status` ∈ `{SUSPENDED, CANCELLED}`; banner si `PAST_DUE`

#### 1.2 — Catálogo editable

- [ ] **CRUD de Categorías** — `/dashboard/categorias`
  - List + create + edit + delete + reordenar (drag) + jerarquía padre/hijo
  - Server actions en `server/actions/categories.ts`
- [ ] **CRUD de Productos** — `/dashboard/productos`
  - List con filtros (categoría, activo, stock bajo, destacado)
  - Form: nombre, slug auto, descripción, precios (`basePrice` / `comparePrice`), stock, badges (`isNew`, `isBestSeller`, `customLabel`), horarios de disponibilidad, categoría
  - Subida de imágenes múltiples (mín. 1, máx. plan-dependiente)
  - **Variantes**: tabla de `ProductVariant` con atributos JSON (talla, sabor, etc.)
  - Server actions en `server/actions/products.ts`
- [ ] **Subida de imágenes** — `lib/storage/upload.ts`
  - **Decisión clave**: local (`/var/www/uploads`, ya está en `.env`) **vs** S3/R2/UploadThing
  - Validación: MIME (`image/jpeg|png|webp`), tamaño (`MAX_UPLOAD_SIZE_MB`), magic bytes
  - Optimización con `sharp`: resize a 1600px max, convertir a WebP, generar thumbnail
  - Devolver URL pública (`PUBLIC_UPLOADS_URL/<storeId>/<uuid>.webp`)

#### 1.3 — Pedidos end-to-end

- [ ] **Crear pedido en checkout** — `server/actions/orders.ts` → `createOrder()`
  - Input: `cartId`, datos del cliente, dirección, método de pago, cupón, comprobante (si QR)
  - Validar stock (si `manageStock`), recalcular totales server-side (no confiar en el cliente), aplicar cupón (`Coupon` con validación de fechas/límites), calcular delivery según `DeliveryZone` o `defaultDeliveryFee`
  - Transacción: crea `Order` + `OrderItem[]` + `OrderEvent` (`type=ORDER_CREATED`) + decrementa stock + actualiza `Customer` (upsert por `[storeId, phone]`)
  - Devuelve `trackingToken` para redirigir a `/[slug]/orden/[token]`
- [ ] **Página de seguimiento del cliente** — `app/[slug]/orden/[token]/page.tsx` real
  - Estado actual del pedido, timeline de `OrderEvent`, link de WhatsApp pre-armado
  - Polling con `revalidate: 30` o Server-Sent Events para estados en vivo
- [ ] **Mensaje de WhatsApp** — `lib/whatsapp/buildOrderMessage.ts` ya existe (revisar)
  - Botón en checkout: `wa.me/<phone>?text=<encoded>` con resumen + link de tracking
  - Guardar `whatsappOpenedAt`, `whatsappMessage` en `Order`
- [ ] **Gestión de pedidos del owner** — `/dashboard/pedidos`
  - List con filtros por estado, badges de notificación
  - Detalle: cambiar estado (`NEW → CONFIRMED → PREPARING → IN_DELIVERY → DELIVERED`), ver comprobante, **verificar pago** (`paymentStatus: AWAITING_VERIFICATION → VERIFIED|REJECTED`)
  - Cada cambio crea un `OrderEvent` con `byUserId`
  - Sonido + notificación browser para pedidos nuevos (Web Push opcional)

#### 1.4 — Cupones y zonas de delivery (lite)

- [ ] **CRUD Cupones** — `/dashboard/cupones`
- [ ] **CRUD Zonas de delivery** — `/dashboard/zonas`
  - MVP: lista de zonas con nombre + tarifa + estimación. Polígono real puede ser Fase 2.

#### 1.5 — Billing manual *(crítico para cobrarle al cliente)*

- [ ] **Generación de Invoice mensual** — `lib/billing/generateInvoice.ts`
  - Cron diario (`app/api/cron/billing/route.ts` ya tiene la carpeta)
  - Para cada `Store` con `nextInvoiceAt <= today`: crear `Invoice` con `amount = plan.monthlyPriceBob` o `yearlyPriceBob`, `dueDate = today + BILLING_DUE_DAYS`
  - Cron de recordatorios: día 3, día 1 antes, día de vencimiento
  - Cron de cambio de status: vencida + grace → `Store.status = PAST_DUE`; pasados N días → `SUSPENDED`
- [ ] **Vista de facturación del owner** — `/dashboard/facturacion`
  - Lista de invoices, link al QR de pago tuyo, botón "subir comprobante"
- [ ] **Verificación de pagos del SaaS** — `/admin/cobranzas`
  - Tu cara: facturas pendientes, comprobantes subidos, botón "marcar pagada" (asigna `verifiedById`, `paidAt`, mueve `Store.status` a `ACTIVE`, recalcula `nextInvoiceAt`)

#### 1.6 — Email transaccional mínimo

- [ ] **Setup SMTP** — `lib/email/sendEmail.ts` con `nodemailer` o Resend
  - Plantillas en `nibble/templates/` (ya existe la carpeta)
  - Eventos: bienvenida (registro), reset password, factura emitida, factura por vencer, factura vencida, pedido creado (al owner), pago verificado (al cliente)

#### 1.7 — Hardening pre-launch

- [ ] **Validación server-side everywhere** — todos los server actions con Zod
- [ ] **Rate limiting** en login, registro, checkout, recovery — `@upstash/ratelimit` o middleware custom
- [ ] **CSRF**: NextAuth ya cubre; Server Actions también, pero verificar checkout flow
- [ ] **Recovery de contraseña** — completar `app/(auth)/recovery` con server action que cree `PasswordReset` y mande email
- [ ] **AuditLog** — instrumentar acciones sensibles (login, cambio de plan, suspensión, verificación de pago)
- [ ] **Error tracking** — `SENTRY_DSN` ya en `.env`, falta integrarlo
- [ ] **Health check** — `app/api/health/route.ts` con check de DB + storage

---

### 🟧 Fase 2 — Profesionalización (3–4 semanas)

**Meta**: que la operación escale sin que tengas que estar manual con cada cliente.

- [ ] **Banners y popups gestionables** — CRUD desde `/dashboard/marketing`
- [ ] **Multi-staff** (cashiers): owner invita usuarios `CASHIER` con permisos limitados
- [ ] **Analytics owner** — `/dashboard/analytics`
  - PageViews por día, productos más vistos, conversion rate (vistas → pedidos)
  - Funnel: storefront → producto → carrito → checkout → pedido
  - Implementar tracking en `lib/analytics/track.ts` + endpoint `app/api/analytics/route.ts`
- [ ] **Analytics admin** — `/admin/analytics`
  - MRR/ARR real, churn, GMV por tienda, top stores, distribución por vertical
- [ ] **Plan limits** — middleware que valide `maxProducts`, `maxOrdersPerMonth`, `maxStaff` antes de cada acción
- [ ] **QR dinámico** — integración con QR Simple (Banco Económico/BCP API si está disponible) detrás del feature flag `FEATURE_DYNAMIC_QR`
- [ ] **Multi-branch** — `Store` con sub-locaciones (feature flag `FEATURE_MULTI_BRANCH`)
- [ ] **Custom domains** — el owner conecta `tienda.com` además de `madrigueras.app/su-slug`
  - Validación TXT, certificado vía Caddy on-demand TLS o Cloudflare for SaaS
- [ ] **PWA** — el storefront instalable + offline read-only
- [ ] **Tests E2E críticos** — Playwright: registro → crear producto → checkout → verificar pago

---

### 🟨 Fase 3 — Crecimiento (cuando haya 50+ tiendas)

- [ ] **AI chatbot** por tienda (modelo `AiChatSession` ya existe) — feature flag `FEATURE_AI_CHATBOT`
- [ ] **Email marketing** — campañas a `Customer[]` desde `/dashboard/marketing/campañas`
- [ ] **Programa de referidos**
- [ ] **App móvil (Expo)** para el owner — recepción de pedidos con notif push nativa
- [ ] **Integración con métodos de pago automatizados** — pasarela tipo PagaTodo, Tigo Money API
- [ ] **Marketplace** — `madrigueras.app/explorar` con búsqueda cross-tienda
- [ ] **Reportes contables** exportables (CSV/Excel)

---

## 🛠️ Infraestructura mínima para producción

- [ ] **VPS/Cloud** — DigitalOcean droplet 2GB ($12/mes) o Railway/Fly.io
  - **Decisión**: ¿hospedar tú o serverless (Vercel)? Para Bolivia → VPS con CDN regional o Vercel + R2/S3 para uploads
- [ ] **PostgreSQL gestionado** — Neon, Supabase, o RDS (no auto-hospedar al inicio)
- [ ] **Storage** — Cloudflare R2 (gratis hasta 10GB) o S3
- [ ] **DNS + SSL** — Cloudflare (gratis), apuntar `madrigueras.app` y `*.madrigueras.app` (wildcard)
- [ ] **CDN para imágenes** — Cloudflare en frente del bucket
- [ ] **CI/CD** — GitHub Actions: lint → typecheck → test → build → deploy
- [ ] **Backups automáticos** de DB diarios, retención 30 días
- [ ] **Logs centralizados** — Sentry para errores, Axiom/Logtail para HTTP
- [ ] **Uptime monitoring** — BetterStack o UptimeRobot

---

## 📋 Setup en otra computadora

Cuando llegues a la otra compu (Linux/Mac/otra Win):

```bash
git clone https://github.com/AndreeAng/madriguerashop.git
cd madriguerashop/nibble
cp .env.example .env
# Llenar: DATABASE_URL, NEXTAUTH_SECRET (openssl rand -base64 32),
#         SMTP_*, SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD
npm install
npm run db:generate
npm run db:push       # primera vez (crea tablas)
npm run db:seed       # super admin + tienda demo
npm run dev
```

App en `http://localhost:3000`. Login del super admin con las credenciales del `.env`.

---

## 🎯 Decisiones pendientes que solo TÚ puedes tomar

> Estas no son tareas de código — son **decisiones de producto** que bloquean la Fase 1.

1. **Pricing real** — ¿cuánto cobrarás por mes/año por plan? Hoy `Plan` está vacío en seed. Sugerencia para Bolivia:
   - Básico: Bs 99/mes (50 productos, 100 pedidos/mes)
   - Pro: Bs 199/mes (sin límite, dynamic QR, analytics)
   - Negocio: Bs 399/mes (multi-branch, AI chatbot, custom CSS)
2. **QR estático tuyo** — necesitás *uno* (QR Simple desde tu banco) para que los clientes te paguen el SaaS. Subilo a `/admin/settings`.
3. **Dominio comercial** — `madrigueras.app`, `madriguerashop.com`, otro? Esto define el `APP_URL` final.
4. **Hosting** — ¿VPS propio (más barato, más trabajo) o Vercel + Neon (más caro, cero ops)?
5. **Marca de email** — `no-reply@madrigueras.app`. Para SMTP: Brevo (gratis 300/día) o Resend ($20/mes 50k).
6. **Política de cancelación / reembolso** — necesaria para Términos y Condiciones.
7. **Términos y Privacidad** — bloquea el registro legalmente. Genera con Termly o un abogado local.
8. **Período de prueba** — hoy `trialEndsAt = now() + 14d` por convención. ¿Confirmás 14 días gratis?

---

## ⚠️ Bloqueadores legales/operativos

- [ ] **Facturación electrónica Bolivia** — si emitís facturas formales, integración con Impuestos Nacionales (SIAT). MVP puede operar con recibos simples mientras se factura por separado.
- [ ] **Protección de datos** — Bolivia tiene Ley 164 (telecomunicaciones) y normas sectoriales; recolectás teléfono + dirección de clientes finales: necesitás política de privacidad clara.
- [ ] **Contratos con clientes** — Términos del SaaS (tu acuerdo con el dueño de la tienda) ≠ Términos de cada storefront (acuerdo del owner con sus compradores).

---

## 🧭 Próximo paso recomendado

**No empezás por todo a la vez.** Orden sugerido para Fase 1:

1. **Onboarding + Settings tienda** (1.1) → ya hay un cliente real con su tienda en DB
2. **CRUD productos + storage** (1.2) → el cliente puede llenar su catálogo
3. **Storefront real** (1.1 último ítem) → el cliente comparte su link y la gente *ve* la tienda
4. **Pedidos end-to-end** (1.3) → empieza a recibir pedidos
5. **Billing manual** (1.5) → empezás a cobrar
6. Hardening (1.7) en paralelo desde el día 1

Cuando puedas demostrarle a un dueño de wings/pizza/etc. los pasos 1-4 funcionando, ya tenés un producto vendible.
