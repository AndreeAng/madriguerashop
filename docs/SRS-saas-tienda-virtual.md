# Software Requirements Specification (SRS)
## SaaS de Tienda Virtual para Bolivia

| Campo | Valor |
|---|---|
| **Versión** | 1.0 |
| **Fecha** | 28 de abril de 2026 |
| **Estado** | Listo para implementación con Claude Code |
| **Idioma del producto** | Español (Bolivia) |
| **Mercado objetivo** | Pymes y emprendedores bolivianos (comida, retail, ferretería, servicios) |
| **Competidor directo** | Quick One (myquickone.com) |
| **Modelo** | SaaS multi-tenant, hosting en VPS propio |

---

## 0. Cómo usar este documento

Este SRS es la **única fuente de verdad** para implementar el SaaS. Está diseñado para entregarse a **Claude Code** sección por sección.

**Convenciones:**

- `[MVP]` → debe estar en los primeros 4 meses.
- `[V2]` → meses 5–8.
- `[V3]` → meses 9 en adelante.
- `[CONFIGURABLE]` → comportamiento ajustable por el dueño de la tienda.
- `[GLOBAL]` → comportamiento controlado solo por Super Admin.
- `🔒` → requiere autenticación.
- `⚡` → requiere tiempo real (WebSocket / SSE / polling).

**Glosario:**

- **Super Admin** → tú, dueño del SaaS.
- **Store / Tienda / Tenant** → una tienda virtual de un cliente del SaaS.
- **Slug** → identificador URL único de cada tienda (ej: `big-bite-wings`).
- **Store Owner** → dueño de una tienda (tu cliente directo).
- **Cashier / Cajero** → empleado de una tienda con permisos limitados.
- **Customer** → cliente final logueado que compra en una tienda.
- **Guest** → cliente final sin cuenta.
- **MVP** → entregable mínimo viable; incluye lo necesario para vender la primera tienda y operar.

---

## 1. Decisiones de producto (resumen ejecutivo)

Resumen de las decisiones tomadas con el usuario. Esta tabla es el contrato.

| # | Tema | Decisión |
|---|---|---|
| 1 | Stack frontend | Next.js 15 (App Router) full-stack |
| 2 | Hosting | VPS propio (NO Vercel) con Docker Compose + Nginx |
| 3 | Estructura URL | **Path-based**: `tutiendabo.com/{slug}` |
| 4 | Dominio principal | A definir (placeholder: `tutiendabo.com`) |
| 5 | Dominio propio del cliente | NO en MVP. Solo subpath del dominio principal |
| 6 | Asignación de slug | Solo Super Admin asigna |
| 7 | Roles | Super Admin, Store Owner, Cashier, Customer, Guest |
| 8 | Auth | Username (email O teléfono) + password. Sin OAuth, sin OTP |
| 9 | Recovery | Email |
| 10 | Customer signup | Guest checkout + opción de crear cuenta al final |
| 11 | Creación de tiendas | Solo Super Admin |
| 12 | Métricas Super Admin | Suite completa BI + heatmap geográfico |
| 13 | Acciones Super Admin sobre tiendas | Suspender, eliminar, impersonar |
| 14 | Directorio público | SÍ (`/tiendas`) |
| 15 | Productos | Variantes, subcategorías, stock opcional, 1–5 imágenes, horarios |
| 16 | Importación CSV | Desde día 1 |
| 17 | Productos digitales | NO en MVP — pendiente |
| 18 | Promociones | Popup (al entrar, 1×sesión, con CTA), banners, cupones, etiquetas (Nuevo/Best Seller), precio tachado |
| 19 | Pagos | QR estático (img subida) + Contra entrega (toggleable). QR dinámico en plan superior |
| 20 | Comprobante | Cliente sube imagen del comprobante después del QR |
| 21 | Carrito | Persistente (localStorage + DB cuando hay sesión) |
| 22 | Checkout | Mapa con pin + dirección texto + aclaración + zonas opcionales |
| 23 | Costo de envío | `[CONFIGURABLE]`: zonas con tarifa o "se confirma por WhatsApp" |
| 24 | WhatsApp pedido | Link `wa.me` con mensaje precargado bonito y estructurado |
| 25 | Confirmación al cliente | Dueño escribe manualmente en MVP |
| 26 | Botón WhatsApp flotante | NO. Reemplazado por Chatbot IA (plan Business) |
| 27 | Estados de pedido | Nuevo → Confirmado → Preparando → En camino → Entregado (+ Cancelado) |
| 28 | Notif tiempo real al dueño | SÍ (sonido + badge) |
| 29 | Tracking público de pedido | SÍ (link único sin login) |
| 30 | Historial cliente | SÍ por número de teléfono |
| 31 | Plantillas en MVP | 5 verticales: Restaurante, Food Truck, Retail, Ferretería, Servicios |
| 32 | Editor | Panel de campos en MVP (NO drag-drop) |
| 33 | Dark mode | Auto (preferencia del sistema del visitante) + toggle manual |
| 34 | Imágenes | Local en VPS (`/var/www/uploads`) |
| 35 | Notif al dueño | WhatsApp (link wa.me con resumen) |
| 36 | Notif al Super Admin | SÍ (alertas de impago, churn, registros) |
| 37 | Idioma | Solo español |
| 38 | Moneda | Solo BOB |
| 39 | IVA | Incluido en el precio |
| 40 | Billing del SaaS | Desde día 1, mensual + anual, sistema lo maneja completo |
| 41 | SEO | Sitemap por tienda, schema.org Product, GA/Pixel `[V2]` |
| 42 | T&C / Privacidad | Genéricos del SaaS |
| 43 | Facturación SIN | Post-MVP |
| 44 | Performance objetivo | LCP < 2,5s en 3G boliviano |
| 45 | Disponibilidad | 99,5% mensual |
| 46 | Backups | Diarios automáticos |
| 47 | Export Excel | Datos, gráficos, todo lo BI |

---

## 2. Stack tecnológico

### 2.1 Decisiones técnicas

| Capa | Elección | Versión | Justificación |
|---|---|---|---|
| Framework | **Next.js** | 15.x | App Router, Server Components, Server Actions, Route Handlers — un solo deploy en VPS |
| Lenguaje | **TypeScript** | 5.5+ | Estricto (`"strict": true`, `"noUncheckedIndexedAccess": true`) |
| Runtime | **Node.js** | 20 LTS | LTS estable hasta abril 2026 |
| Base de datos | **PostgreSQL** | 16 | JSONB, full-text search, RLS si se necesita |
| ORM | **Prisma** | 5.x | Type-safe, migraciones, multi-schema fácil |
| Cache / Sesiones / Queue | **Redis** | 7.x | Carrito persistente, rate limiting, BullMQ para jobs |
| Auth | **Auth.js (NextAuth v5)** | 5.x beta estable | Credentials provider con username (email O phone) |
| UI primitives | **Radix UI** + **shadcn/ui** | latest | Accesible WAI-ARIA, totalmente personalizable |
| Estilos | **Tailwind CSS** | 4.x | Design tokens vía CSS vars por tenant |
| Forms | **React Hook Form** + **Zod** | latest | Validación end-to-end (cliente + servidor) |
| Tablas | **TanStack Table** | 8.x | Sorting, filtering, paginación |
| Charts | **Recharts** + **Apache ECharts** | latest | Recharts para dashboards simples, ECharts para heatmap geográfico |
| Mapas | **Leaflet** + **OpenStreetMap** | 1.9+ | Gratis, sin API key, suficiente para Bolivia |
| Heatmap | **leaflet.heat** | latest | Heatmap de pedidos por área |
| Editor texto | **Tiptap** | latest | Descripciones de producto WYSIWYG |
| Imágenes | **sharp** | latest | Resize/compress/WebP en upload |
| Email | **Nodemailer** + SMTP propio (Postfix en VPS) o **Resend** | — | SMTP propio para no depender de terceros |
| Logs | **Pino** | latest | JSON estructurado, rotación con `pino-roll` |
| Errors | **Sentry** (self-host opcional) | latest | Tier free hasta 5k errores/mes |
| Analytics propio | **Umami** o **Plausible** self-hosted | — | Privacy-first, en el mismo VPS |
| Storage | **Filesystem local** (`/var/www/uploads`) | — | Servido por Nginx con cache headers |
| Reverse proxy | **Nginx** | latest | SSL termination, static serve, rate limiting básico |
| SSL | **Let's Encrypt** vía **Certbot** | — | Renovación auto |
| Containerización | **Docker** + **Docker Compose** | latest | App + Postgres + Redis + Nginx |
| CI/CD | **GitHub Actions** | — | Build + tests + SSH deploy a VPS |
| Process manager | **pm2** dentro del contenedor o `node` directo | — | pm2 para reinicio automático y cluster mode |
| Testing | **Vitest** + **Playwright** | latest | Vitest unit, Playwright e2e |
| Linter / Format | **Biome** o ESLint + Prettier | latest | Biome es más rápido |

### 2.2 ¿Por qué Next.js full-stack y no NestJS separado?

En el reporte previo se sugirió NestJS como API separada. **Cambio de recomendación con razón explícita:**

1. **Operación más simple en VPS único.** Un solo contenedor de aplicación en lugar de dos (app + api).
2. **Menos partes móviles** = menos cosas que pueden romperse a las 3 AM.
3. **Server Actions de Next.js** cubren el 95% de lo que harías con una API REST separada para CRUD interno.
4. **Route Handlers** (`app/api/**`) cubren el resto: webhooks, integraciones externas, callbacks de pasarelas.
5. Si en V3 necesitas exponer una API pública para integradores, se extrae el módulo a NestJS sin reescribir el frontend.

### 2.3 Variables de entorno (`.env`)

```bash
# === Base ===
NODE_ENV=production
NEXTAUTH_URL=https://tutiendabo.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
APP_URL=https://tutiendabo.com

# === Database ===
DATABASE_URL=postgresql://user:pass@postgres:5432/tutiendabo

# === Redis ===
REDIS_URL=redis://redis:6379

# === Storage ===
UPLOAD_DIR=/var/www/uploads
PUBLIC_UPLOADS_URL=https://tutiendabo.com/uploads
MAX_UPLOAD_SIZE_MB=5

# === Email (SMTP propio) ===
SMTP_HOST=smtp.tutiendabo.com
SMTP_PORT=587
SMTP_USER=no-reply@tutiendabo.com
SMTP_PASS=<password>
SMTP_FROM="TuTiendaBo <no-reply@tutiendabo.com>"

# === Logging / Monitoring ===
SENTRY_DSN=
LOG_LEVEL=info

# === Chatbot IA (V2 / Business) ===
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# === Maps ===
# Leaflet+OSM no requiere API key
# Si en V3 se migra a Mapbox:
NEXT_PUBLIC_MAPBOX_TOKEN=

# === Billing ===
BILLING_INVOICE_PREFIX=TTB-
BILLING_DUE_DAYS=7
BILLING_GRACE_DAYS=5

# === Featureflags ===
FEATURE_DYNAMIC_QR=false
FEATURE_AI_CHATBOT=false
FEATURE_MULTI_BRANCH=false

# === Super Admin seed ===
SEED_SUPER_ADMIN_EMAIL=
SEED_SUPER_ADMIN_PASSWORD=
```

---

## 3. Arquitectura

### 3.1 Multi-tenancy: estrategia path-based

Todas las tiendas viven bajo el dominio principal con un **slug** único:

```
tutiendabo.com/                 → Marketing site
tutiendabo.com/tiendas          → Directorio público
tutiendabo.com/login            → Login único (detecta rol)
tutiendabo.com/admin            → 🔒 Super Admin
tutiendabo.com/dashboard        → 🔒 Store Owner / Cashier (resuelve tienda por sesión)
tutiendabo.com/{slug}           → Storefront público
tutiendabo.com/{slug}/p/{prod}  → Producto
tutiendabo.com/{slug}/c/{cat}   → Categoría
tutiendabo.com/{slug}/checkout  → Checkout
tutiendabo.com/{slug}/orden/{token}  → Tracking público de pedido
tutiendabo.com/api/**           → Route Handlers (webhooks, uploads)
tutiendabo.com/uploads/**       → Static (servido directo por Nginx)
```

**¿Por qué path-based y no subdominio?**
- En VPS sin wildcard SSL configurado, path-based es trivial.
- El slug se resuelve en `middleware.ts` con un lookup a Postgres (cacheado en Redis).
- Si en V3 se decide migrar a subdominios o dominios propios, **toda la lógica multi-tenant ya está aislada en `lib/tenant.ts`** y solo cambia el resolver del middleware. El resto del código no toca.

### 3.2 Resolución de tenant (middleware Next.js)

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantBySlug } from '@/lib/tenant/resolve'

const RESERVED = new Set([
  'admin', 'dashboard', 'login', 'logout', 'register', 'recovery',
  'tiendas', 'about', 'pricing', 'terms', 'privacy', 'api',
  'uploads', '_next', 'sitemap.xml', 'robots.txt', 'favicon.ico'
])

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const segments = url.pathname.split('/').filter(Boolean)
  const first = segments[0]

  // Marketing / sistema
  if (!first || RESERVED.has(first)) return NextResponse.next()

  // Es un slug de tienda → validar existencia
  const tenant = await resolveTenantBySlug(first)
  if (!tenant) {
    url.pathname = '/404-tienda'
    return NextResponse.rewrite(url)
  }
  if (tenant.status === 'SUSPENDED') {
    url.pathname = '/tienda-suspendida'
    return NextResponse.rewrite(url)
  }

  // Inyectar tenant en headers para Server Components
  const res = NextResponse.next()
  res.headers.set('x-tenant-id', tenant.id)
  res.headers.set('x-tenant-slug', tenant.slug)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)']
}
```

`resolveTenantBySlug` lee de Redis cache (TTL 5 min) y cae a Postgres.

### 3.3 Estructura del proyecto (monorepo simple)

Decisión: **un solo Next.js project**, NO Turborepo ni monorepo multi-app. Más simple, suficiente.

```
tutiendabo/
├── apps/
│   └── web/                    # Next.js 15 full-stack
│       ├── app/
│       │   ├── (marketing)/    # Landing público
│       │   ├── (auth)/         # Login, register, recovery
│       │   ├── admin/          # Super Admin Panel 🔒
│       │   ├── dashboard/      # Store Owner Panel 🔒
│       │   ├── tiendas/        # Directorio público
│       │   ├── [slug]/         # Storefront público de cada tienda
│       │   │   ├── page.tsx
│       │   │   ├── p/[product]/
│       │   │   ├── c/[category]/
│       │   │   ├── checkout/
│       │   │   └── orden/[token]/
│       │   ├── api/            # Route Handlers
│       │   │   ├── upload/
│       │   │   ├── webhooks/
│       │   │   └── cron/
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/             # shadcn primitives
│       │   ├── storefront/     # componentes públicos
│       │   ├── dashboard/      # componentes panel
│       │   ├── admin/          # componentes super admin
│       │   └── shared/
│       ├── lib/
│       │   ├── auth/
│       │   ├── tenant/
│       │   ├── db.ts           # Prisma client singleton
│       │   ├── redis.ts
│       │   ├── storage/        # uploads
│       │   ├── billing/
│       │   ├── notifications/
│       │   ├── whatsapp/
│       │   ├── analytics/
│       │   ├── ai/             # chatbot IA (V2)
│       │   └── utils.ts
│       ├── server/
│       │   ├── actions/        # Server Actions agrupadas
│       │   │   ├── auth.actions.ts
│       │   │   ├── product.actions.ts
│       │   │   ├── order.actions.ts
│       │   │   ├── store.actions.ts
│       │   │   └── ...
│       │   └── services/       # lógica de negocio
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── templates/          # Plantillas verticales
│       │   ├── restaurant/
│       │   ├── food-truck/
│       │   ├── retail/
│       │   ├── hardware/
│       │   └── services/
│       ├── public/
│       ├── tests/
│       │   ├── unit/
│       │   └── e2e/
│       ├── middleware.ts
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   └── tutiendabo.conf
│   └── scripts/
│       ├── backup.sh
│       └── deploy.sh
├── docs/
│   ├── README.md
│   └── runbook.md
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

### 3.4 Diagrama de despliegue (VPS)

```
┌──────────────────────────────────────────────────────┐
│                       VPS                            │
│                                                      │
│  ┌─────────┐   ┌──────────────────────────┐          │
│  │  Nginx  │──▶│   Next.js 15 (PM2)       │          │
│  │  :443   │   │   :3000                  │          │
│  │  SSL    │   │   - SSR/RSC              │          │
│  │         │   │   - Server Actions       │          │
│  │         │   │   - Route Handlers       │          │
│  └────┬────┘   └────┬──────────┬──────────┘          │
│       │             │          │                     │
│       │             ▼          ▼                     │
│       │      ┌──────────┐  ┌────────┐                │
│       │      │ Postgres │  │ Redis  │                │
│       │      │  :5432   │  │ :6379  │                │
│       │      └──────────┘  └────────┘                │
│       │                                              │
│       └──▶ /var/www/uploads (static)                 │
│                                                      │
│  ┌──────────────────────────────────────────┐        │
│  │  Cron jobs (host)                        │        │
│  │  - backup diario (pg_dump + uploads)     │        │
│  │  - certbot renew                         │        │
│  │  - cleanup carritos expirados            │        │
│  │  - generación de invoices mensuales      │        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
              │                       │
              ▼                       ▼
       Cliente final            Store Owner
       (browser móvil)          (browser/PWA)
```

---

## 4. Modelo de datos completo (Prisma)

Schema listo para `prisma/schema.prisma`. Diseñado para multi-tenant **shared schema** (todas las tablas tienen `storeId` donde aplica). Sin Row Level Security en MVP — la garantía la da la capa de Server Actions con `assertCanAccessStore(userId, storeId)`.

### 4.1 Schema completo

```prisma
// =================================================================
// schema.prisma — TuTiendaBo (placeholder name)
// =================================================================

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============== USUARIOS Y AUTH ==============

enum Role {
  SUPER_ADMIN
  STORE_OWNER
  CASHIER
  CUSTOMER
}

model User {
  id            String   @id @default(cuid())
  username      String   @unique          // email O teléfono
  email         String?  @unique
  phone         String?  @unique          // +591XXXXXXXX
  passwordHash  String
  role          Role
  fullName      String?
  storeId       String?                   // null para SUPER_ADMIN y CUSTOMER
  store         Store?   @relation(fields: [storeId], references: [id], onDelete: SetNull)
  isActive      Boolean  @default(true)
  emailVerifiedAt DateTime?
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions      Session[]
  passwordResets PasswordReset[]
  customer      Customer?
  orderEventsCreated OrderEvent[]

  @@index([storeId])
  @@index([role])
}

model Session {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String   @unique
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  ipAddress  String?
  userAgent  String?

  @@index([userId])
  @@index([expiresAt])
}

model PasswordReset {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

// ============== TIENDAS ==============

enum StoreStatus {
  TRIAL          // primeros 30 días
  ACTIVE
  PAST_DUE       // factura vencida en período de gracia
  SUSPENDED      // por impago o por Super Admin
  CANCELLED
}

enum StoreVertical {
  RESTAURANT
  FOOD_TRUCK
  RETAIL
  HARDWARE
  SERVICES
}

model Store {
  id              String        @id @default(cuid())
  slug            String        @unique
  name            String
  vertical        StoreVertical
  status          StoreStatus   @default(TRIAL)
  description     String?

  // Branding
  logoUrl         String?
  faviconUrl      String?
  bannerUrl       String?
  primaryColor    String        @default("#3B82F6")
  secondaryColor  String        @default("#1E40AF")
  accentColor     String        @default("#F59E0B")
  fontFamily      String        @default("Inter")
  templateId      String
  template        Template      @relation(fields: [templateId], references: [id])
  darkModeAllowed Boolean       @default(true)

  // Contacto
  whatsappPhone   String        // +591XXXXXXXX (REQUERIDO)
  email           String?
  addressText     String?
  city            String?
  lat             Float?
  lng             Float?

  // Redes sociales
  instagram       String?
  facebook        String?
  tiktok          String?
  website         String?

  // Pagos
  qrImageUrl      String?
  qrInstructions  String?       @db.Text
  acceptsCashOnDelivery Boolean @default(true)
  acceptsQR       Boolean       @default(true)

  // Delivery
  deliveryEnabled Boolean       @default(true)
  pickupEnabled   Boolean       @default(false)
  defaultDeliveryFee Decimal?   @db.Decimal(10, 2)
  deliveryNote    String?       // ej: "Costo final se confirma por WhatsApp"
  freeDeliveryAbove Decimal?    @db.Decimal(10, 2)

  // SEO
  metaTitle       String?
  metaDescription String?
  metaKeywords    String?
  ogImageUrl      String?

  // Plan
  planId          String
  plan            Plan          @relation(fields: [planId], references: [id])
  billingCycle    BillingCycle  @default(MONTHLY)
  trialEndsAt     DateTime?
  subscriptionEndsAt DateTime?
  nextInvoiceAt   DateTime?

  // Operación
  isPubliclyListed Boolean      @default(true)   // aparece en /tiendas
  ownerNotes      String?       @db.Text         // notas internas del Super Admin

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  suspendedAt     DateTime?
  suspendedReason String?

  // Relaciones
  users           User[]
  categories      Category[]
  products        Product[]
  orders          Order[]
  customers       Customer[]
  coupons         Coupon[]
  banners         Banner[]
  popups          Popup[]
  deliveryZones   DeliveryZone[]
  storeHours      StoreHours[]
  invoices        Invoice[]
  pageViews       PageView[]
  carts           Cart[]
  aiChatSessions  AiChatSession[]

  @@index([status])
  @@index([slug])
}

model Template {
  id           String        @id @default(cuid())
  name         String
  vertical     StoreVertical
  description  String
  previewUrl   String
  componentKey String        @unique  // "restaurant_v1", "retail_v1", etc
  isActive     Boolean       @default(true)
  sortOrder    Int           @default(0)
  stores       Store[]
}

model StoreHours {
  id        String  @id @default(cuid())
  storeId   String
  store     Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  dayOfWeek Int     // 0=Lunes, 6=Domingo
  openTime  String  // "08:00"
  closeTime String  // "22:00"
  isClosed  Boolean @default(false)

  @@unique([storeId, dayOfWeek])
}

// ============== CATÁLOGO ==============

model Category {
  id          String     @id @default(cuid())
  storeId     String
  store       Store      @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  description String?
  imageUrl    String?
  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children    Category[] @relation("CategoryTree")
  sortOrder   Int        @default(0)
  isVisible   Boolean    @default(true)
  products    Product[]

  @@unique([storeId, slug])
  @@index([parentId])
  @@index([storeId])
}

model Product {
  id              String    @id @default(cuid())
  storeId         String
  store           Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  sku             String?
  name            String
  slug            String
  description     String?   @db.Text
  shortDescription String?

  // Precios (en BOB, IVA incluido)
  basePrice       Decimal   @db.Decimal(10, 2)
  comparePrice    Decimal?  @db.Decimal(10, 2)  // precio tachado

  // Stock opcional (configurable por producto)
  manageStock     Boolean   @default(false)
  stock           Int       @default(0)
  lowStockAlert   Int?

  // Estado
  isActive        Boolean   @default(true)
  isFeatured      Boolean   @default(false)

  // Etiquetas visuales
  isNew           Boolean   @default(false)
  isBestSeller    Boolean   @default(false)
  customLabel     String?   // "Solo hoy"
  customLabelColor String?

  // Disponibilidad por horario
  hasSchedule     Boolean   @default(false)
  availableFrom   String?   // "07:00"
  availableTo     String?   // "11:00"
  availableDays   Int[]     @default([])  // [0,1,2,3,4,5,6]

  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  images          ProductImage[]
  variants        ProductVariant[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([storeId, slug])
  @@index([categoryId])
  @@index([isActive, storeId])
  @@index([isFeatured])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  alt       String?
  sortOrder Int     @default(0)
}

model ProductVariant {
  id           String   @id @default(cuid())
  productId    String
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name         String   // "Mediana - Roja"
  sku          String?

  // Override del producto base
  price        Decimal? @db.Decimal(10, 2)
  comparePrice Decimal? @db.Decimal(10, 2)

  // Stock por variante
  manageStock  Boolean  @default(false)
  stock        Int      @default(0)

  // Atributos para display
  attributes   Json     // { size: "M", color: "Red" }
  imageUrl     String?

  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)

  cartItems    CartItem[]
  orderItems   OrderItem[]
}

// ============== PROMOCIONES ==============

enum CouponType {
  PERCENTAGE
  FIXED_AMOUNT
  FREE_SHIPPING
}

model Coupon {
  id                String     @id @default(cuid())
  storeId           String
  store             Store      @relation(fields: [storeId], references: [id], onDelete: Cascade)
  code              String
  description       String?
  type              CouponType
  value             Decimal    @db.Decimal(10, 2)

  minOrderAmount    Decimal?   @db.Decimal(10, 2)
  maxDiscountAmount Decimal?   @db.Decimal(10, 2)

  usageLimit        Int?
  usageLimitPerUser Int?
  usedCount         Int        @default(0)

  validFrom         DateTime
  validTo           DateTime

  isActive          Boolean    @default(true)
  createdAt         DateTime   @default(now())

  orders            Order[]

  @@unique([storeId, code])
  @@index([storeId])
}

model Banner {
  id             String    @id @default(cuid())
  storeId        String
  store          Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  title          String?
  subtitle       String?
  imageUrl       String
  mobileImageUrl String?
  linkUrl        String?
  position       String    @default("hero")  // "hero" | "secondary"
  sortOrder      Int       @default(0)
  isActive       Boolean   @default(true)
  validFrom      DateTime?
  validTo        DateTime?
  createdAt      DateTime  @default(now())

  @@index([storeId, isActive])
}

model Popup {
  id                  String    @id @default(cuid())
  storeId             String
  store               Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  title               String
  message             String    @db.Text
  imageUrl            String?
  ctaText             String?
  ctaUrl              String?
  delaySeconds        Int       @default(3)
  showOncePerSession  Boolean   @default(true)
  isActive            Boolean   @default(true)
  validFrom           DateTime?
  validTo             DateTime?
  createdAt           DateTime  @default(now())

  @@index([storeId, isActive])
}

// ============== DELIVERY ==============

model DeliveryZone {
  id            String   @id @default(cuid())
  storeId       String
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name          String
  polygon       Json     // GeoJSON Polygon
  fee           Decimal  @db.Decimal(10, 2)
  estimatedTime String?  // "30-45 min"
  isActive      Boolean  @default(true)
  sortOrder     Int      @default(0)

  orders        Order[]

  @@index([storeId])
}

// ============== CARRITO Y CUSTOMERS ==============

model Customer {
  id          String   @id @default(cuid())
  storeId     String
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  userId      String?  @unique
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  fullName    String
  phone       String   // username si tiene cuenta
  email       String?

  // Última dirección (para reusar en próximos pedidos)
  lastAddressText String?
  lastLat         Float?
  lastLng         Float?
  lastNote        String?

  // Stats
  ordersCount     Int     @default(0)
  totalSpent      Decimal @default(0) @db.Decimal(10, 2)
  lastOrderAt     DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orders      Order[]

  @@unique([storeId, phone])
  @@index([storeId])
}

model Cart {
  id         String     @id @default(cuid())
  storeId    String
  store      Store      @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customerId String?
  guestToken String?    // cookie para guests
  items      CartItem[]
  couponCode String?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  expiresAt  DateTime   // 7 días desde última actualización

  @@index([storeId])
  @@index([guestToken])
  @@index([expiresAt])
}

model CartItem {
  id         String          @id @default(cuid())
  cartId     String
  cart       Cart            @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId  String
  variantId  String?
  variant    ProductVariant? @relation(fields: [variantId], references: [id])
  quantity   Int
  notes      String?
  unitPrice  Decimal         @db.Decimal(10, 2)  // snapshot al agregar
  createdAt  DateTime        @default(now())

  @@unique([cartId, productId, variantId])
}

// ============== PEDIDOS ==============

enum OrderStatus {
  PENDING_PAYMENT       // QR pendiente comprobante
  NEW                   // recibido (contra entrega o comprobante subido)
  CONFIRMED
  PREPARING
  IN_DELIVERY
  DELIVERED
  CANCELLED
}

enum PaymentMethod {
  QR_STATIC
  QR_DYNAMIC
  CASH_ON_DELIVERY
}

enum PaymentStatus {
  PENDING
  AWAITING_VERIFICATION
  VERIFIED
  REJECTED
  REFUNDED
}

model Order {
  id              String        @id @default(cuid())
  orderNumber     Int           // visible al cliente, secuencia por tienda
  trackingToken   String        @unique  // link público

  storeId         String
  store           Store         @relation(fields: [storeId], references: [id])
  customerId      String?
  customer        Customer?     @relation(fields: [customerId], references: [id])

  // Snapshot del comprador
  customerName    String
  customerPhone   String
  customerEmail   String?

  // Dirección de entrega
  deliveryAddress String        @db.Text
  deliveryLat     Float?
  deliveryLng     Float?
  deliveryNote    String?
  deliveryZoneId  String?
  deliveryZone    DeliveryZone? @relation(fields: [deliveryZoneId], references: [id])

  // Items
  items           OrderItem[]

  // Cálculos
  subtotal        Decimal       @db.Decimal(10, 2)
  discountAmount  Decimal       @default(0) @db.Decimal(10, 2)
  deliveryFee     Decimal?      @db.Decimal(10, 2)
  total           Decimal       @db.Decimal(10, 2)

  // Cupón
  couponId        String?
  coupon          Coupon?       @relation(fields: [couponId], references: [id])
  couponCode      String?

  status          OrderStatus   @default(NEW)

  // Pago
  paymentMethod   PaymentMethod
  paymentStatus   PaymentStatus @default(PENDING)
  paymentProofUrl String?
  paymentVerifiedAt DateTime?
  paymentVerifiedById String?
  paymentRejectedReason String?

  // Notas
  customerNotes   String?       @db.Text
  ownerNotes      String?       @db.Text

  // Timestamps de cambio de estado
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  confirmedAt     DateTime?
  preparingAt     DateTime?
  inDeliveryAt    DateTime?
  deliveredAt     DateTime?
  cancelledAt     DateTime?
  cancelReason    String?

  // WhatsApp
  whatsappOpenedAt DateTime?
  whatsappMessage  String?      @db.Text

  events          OrderEvent[]

  @@unique([storeId, orderNumber])
  @@index([storeId, status])
  @@index([customerId])
  @@index([createdAt])
  @@index([deliveryLat, deliveryLng])
}

model OrderItem {
  id           String          @id @default(cuid())
  orderId      String
  order        Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId    String
  productName  String          // snapshot
  productImageUrl String?      // snapshot
  variantId    String?
  variant      ProductVariant? @relation(fields: [variantId], references: [id])
  variantName  String?         // snapshot
  quantity     Int
  unitPrice    Decimal         @db.Decimal(10, 2)
  subtotal     Decimal         @db.Decimal(10, 2)
  notes        String?
}

model OrderEvent {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  type        String   // STATUS_CHANGE, PAYMENT_VERIFIED, NOTE_ADDED, ITEM_ADDED, ITEM_REMOVED
  description String
  byUserId    String?
  byUser      User?    @relation(fields: [byUserId], references: [id], onDelete: SetNull)
  byUserName  String?
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([orderId])
}

// ============== BILLING (cobranza al merchant) ==============

enum BillingCycle {
  MONTHLY
  YEARLY
}

model Plan {
  id              String   @id @default(cuid())
  name            String   @unique
  slug            String   @unique
  description     String
  monthlyPriceBob Decimal  @db.Decimal(10, 2)
  yearlyPriceBob  Decimal  @db.Decimal(10, 2)

  // Límites
  maxProducts     Int?     // null = ilimitado
  maxOrdersPerMonth Int?
  maxStaff        Int      @default(1)
  maxImagesPerProduct Int  @default(5)

  // Features (flags)
  removeWatermark     Boolean @default(false)
  prioritySupport     Boolean @default(false)
  dynamicQR           Boolean @default(false)
  multiBranch         Boolean @default(false)
  advancedAnalytics   Boolean @default(false)
  emailMarketing      Boolean @default(false)
  aiChatbot           Boolean @default(false)
  customCss           Boolean @default(false)

  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)

  stores          Store[]
}

enum InvoiceStatus {
  DRAFT
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique          // TTB-2026-001234
  storeId       String
  store         Store         @relation(fields: [storeId], references: [id])

  amount        Decimal       @db.Decimal(10, 2)
  currency      String        @default("BOB")

  periodStart   DateTime
  periodEnd     DateTime

  status        InvoiceStatus @default(PENDING)
  dueDate       DateTime
  paidAt        DateTime?
  paidProofUrl  String?
  verifiedAt    DateTime?
  verifiedById  String?

  reminderSentAt DateTime?
  remindersCount Int          @default(0)

  notes         String?       @db.Text

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([storeId])
  @@index([status, dueDate])
}

// ============== ANALYTICS ==============

model PageView {
  id           String   @id @default(cuid())
  storeId      String
  store        Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  path         String
  productId    String?
  referrer     String?
  userAgent    String?
  ip           String?
  country      String?
  city         String?
  visitorToken String?
  sessionToken String?
  createdAt    DateTime @default(now())

  @@index([storeId, createdAt])
  @@index([productId])
}

// ============== AI CHATBOT (V2 / Plan Business) ==============

model AiChatSession {
  id          String   @id @default(cuid())
  storeId     String
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  visitorToken String
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  messages    AiChatMessage[]

  @@index([storeId])
  @@index([visitorToken])
}

model AiChatMessage {
  id         String        @id @default(cuid())
  sessionId  String
  session    AiChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role       String        // "user" | "assistant" | "system"
  content    String        @db.Text
  metadata   Json?         // tokens, model, latency
  createdAt  DateTime      @default(now())
}

// ============== AUDIT LOG ==============

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  actorRole String?
  action    String   // "CREATE_STORE", "SUSPEND_STORE", "IMPERSONATE", etc
  target    String?  // "Store:abc123"
  metadata  Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([actorId])
  @@index([action])
  @@index([createdAt])
}
```

### 4.2 Índices y rendimiento

| Tabla | Índice | Razón |
|---|---|---|
| `Store` | `slug` (unique) | Resolución de tenant en middleware |
| `Store` | `status` | Filtrar tiendas activas en directorio |
| `Product` | `(storeId, slug)` unique | Permalinks únicos por tienda |
| `Product` | `(isActive, storeId)` | Listado público filtrado |
| `Product` | `categoryId` | Listado por categoría |
| `Order` | `(storeId, status)` | Dashboard del dueño |
| `Order` | `createdAt` | Reportes BI por fecha |
| `Order` | `(deliveryLat, deliveryLng)` | Mapa de calor |
| `PageView` | `(storeId, createdAt)` | Analytics por tienda y rango |
| `Invoice` | `(status, dueDate)` | Cron de impagos |
| `Cart` | `expiresAt` | Cleanup nocturno |

### 4.3 Seed inicial (`prisma/seed.ts`)

Debe crear:
1. **Super Admin user** (de variables de entorno).
2. **Plans** seed: Starter (gratis), Pro (Bs 99/mes), Business (Bs 249/mes).
3. **Templates** seed: 5 plantillas verticales con `componentKey` válidos.

---

## 5. Roles, permisos y matriz RBAC

### 5.1 Roles definidos

| Rol | Alcance | Login | Descripción |
|---|---|---|---|
| `SUPER_ADMIN` | Global | `/login` → `/admin` | Tú. Crea/suspende tiendas, ve todas las métricas, ajusta planes, gestiona facturación |
| `STORE_OWNER` | Una tienda | `/login` → `/dashboard` | Cliente del SaaS. Gestiona productos, pedidos, branding, staff |
| `CASHIER` | Una tienda (limitado) | `/login` → `/dashboard` | Empleado. Solo ve y gestiona pedidos. No edita productos ni configuración |
| `CUSTOMER` | Cross-store | `/login` → `/{slug}` | Cliente final con cuenta. Reusa datos entre tiendas |
| `GUEST` | Una sesión | — | Compra sin cuenta. Cookie de carrito |

### 5.2 Matriz de permisos

Notación: ✅ permitido · ❌ denegado · 🔒 solo en su tienda · 🔍 solo lectura

| Acción | SUPER_ADMIN | STORE_OWNER | CASHIER | CUSTOMER | GUEST |
|---|---|---|---|---|---|
| **Tiendas** |
| Crear tienda | ✅ | ❌ | ❌ | ❌ | ❌ |
| Suspender / eliminar tienda | ✅ | ❌ | ❌ | ❌ | ❌ |
| Impersonar tienda | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar branding/config | ✅ | 🔒 | ❌ | ❌ | ❌ |
| **Productos** |
| Crear/editar/eliminar productos | ✅ | 🔒 | ❌ | ❌ | ❌ |
| Ver catálogo público | ✅ | ✅ | ✅ | ✅ | ✅ |
| Importar CSV | ✅ | 🔒 | ❌ | ❌ | ❌ |
| **Pedidos** |
| Ver pedidos | ✅ | 🔒 | 🔒 | 🔒 (los suyos) | 🔒 (token) |
| Cambiar estado | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| Verificar comprobante de pago | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| Editar items del pedido | ✅ | 🔒 | 🔒 | ❌ | ❌ |
| Cancelar pedido | ✅ | 🔒 | 🔒 | 🔒 (si NEW) | 🔒 (si NEW) |
| **Promociones** |
| Crear cupones, banners, popups | ✅ | 🔒 | ❌ | ❌ | ❌ |
| **Staff** |
| Crear/editar usuarios cajeros | ✅ | 🔒 | ❌ | ❌ | ❌ |
| **Billing** |
| Ver invoices propias | ✅ (todas) | 🔒 | ❌ | ❌ | ❌ |
| Marcar invoice como pagada | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cambiar plan | ✅ | 🔒 (solicitar) | ❌ | ❌ | ❌ |
| **Analytics** |
| Ver BI propio | ✅ (todas) | 🔒 | ❌ | ❌ | ❌ |
| Ver heatmap propio | ✅ (todas) | 🔒 | ❌ | ❌ | ❌ |
| Exportar Excel | ✅ | 🔒 | ❌ | ❌ | ❌ |

### 5.3 Implementación

**Helper de autorización** (`lib/auth/guards.ts`):

```ts
export async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError()
  }
  return session.user
}

export async function requireStoreAccess(storeId: string) {
  const session = await auth()
  if (!session?.user) throw new UnauthorizedError()
  if (session.user.role === 'SUPER_ADMIN') return session.user
  if (
    (session.user.role === 'STORE_OWNER' || session.user.role === 'CASHIER') &&
    session.user.storeId === storeId
  ) {
    return session.user
  }
  throw new ForbiddenError()
}

export async function requireStoreOwner(storeId: string) {
  const user = await requireStoreAccess(storeId)
  if (user.role === 'CASHIER') throw new ForbiddenError('Solo el dueño puede hacer esto')
  return user
}
```

**Cada Server Action obligatoriamente** llama un guard al inicio. Sin excepciones.

---

## 6. Módulos funcionales

### 6.1 Módulo: Autenticación

#### 6.1.1 Funcionalidades [MVP]

- Login único con username (email O teléfono normalizado a `+591XXXXXXXX`) + password.
- Detección automática de rol y redirect:
  - `SUPER_ADMIN` → `/admin`
  - `STORE_OWNER`, `CASHIER` → `/dashboard`
  - `CUSTOMER` → `/{slug-última-tienda}` o referrer
- Registro de Customer:
  - Self-service desde el storefront (botón "Crear cuenta") O al final del checkout (opcional).
  - Username = teléfono. Validación formato Bolivia (`+591` + 8 dígitos).
- Recuperación de contraseña:
  - Solicitar por email registrado.
  - Token de un solo uso, expira en 1 hora.
  - Email vía SMTP propio.
- Logout invalida sesión en DB.
- Rate limiting: 5 intentos de login por IP por minuto (Redis).

#### 6.1.2 Reglas de negocio

- Password mínimo 8 caracteres, debe tener mayúscula y número (validación con Zod).
- Hash con `bcrypt` cost 12.
- Sesiones JWT firmadas con `NEXTAUTH_SECRET`, con expiración 30 días + sliding refresh.
- Si un usuario está `isActive: false`, no puede loguear (mensaje genérico "Credenciales inválidas").
- Si la tienda asociada a un STORE_OWNER/CASHIER está SUSPENDED, no puede loguear (mensaje "Tu tienda está suspendida, contacta soporte").

#### 6.1.3 Endpoints / Server Actions

```ts
// server/actions/auth.actions.ts
loginAction({ username: string, password: string }): Promise<{ redirectTo: string }>
registerCustomerAction({ phone, fullName, password, optInMarketing }): Promise<void>
logoutAction(): Promise<void>
requestPasswordResetAction({ email: string }): Promise<void>
resetPasswordAction({ token: string, newPassword: string }): Promise<void>
changePasswordAction({ currentPassword, newPassword }): Promise<void>  // 🔒
```

#### 6.1.4 Criterios de aceptación

- [ ] Un usuario `SUPER_ADMIN` puede loguearse y ser redirigido a `/admin`.
- [ ] Un usuario `STORE_OWNER` puede loguearse y ser redirigido a `/dashboard` mostrando su tienda.
- [ ] Un usuario `CASHIER` ve el `/dashboard` pero los menús de "Productos" y "Configuración" están ocultos/deshabilitados.
- [ ] Un guest puede registrarse en menos de 30 segundos (3 campos: teléfono, nombre, password).
- [ ] El reset de password recibe email en menos de 30 segundos.
- [ ] 5 intentos fallidos bloquean por 15 minutos.
- [ ] Sesión persiste tras refresh.
- [ ] Logout invalida sesión y redirige a `/login`.

---

### 6.2 Módulo: Super Admin Panel

Ruta base: `/admin` 🔒 SUPER_ADMIN

#### 6.2.1 Páginas y funcionalidades [MVP]

| Ruta | Funcionalidad |
|---|---|
| `/admin` | Dashboard global: MRR, ARR, total tiendas activas, churn 30d, pedidos del día agregados, alertas |
| `/admin/tiendas` | Lista de todas las tiendas (tabla) con filtros: estado, plan, vertical, ciudad, fecha de registro. Acciones: ver, editar, suspender, eliminar, impersonar |
| `/admin/tiendas/nueva` | Crear nueva tienda. Form: nombre, slug, vertical, plantilla, plan, datos del owner (email + password inicial), WhatsApp |
| `/admin/tiendas/{id}` | Detalle: información, métricas individuales, actividad reciente, invoices, ver como cliente (impersonar) |
| `/admin/tiendas/{id}/editar` | Editar config global: cambiar plan, cambiar slug, cambiar plantilla, agregar/quitar staff, notas internas |
| `/admin/usuarios` | Lista de todos los usuarios cross-tenant. Filtros por rol, tienda, estado |
| `/admin/planes` | CRUD de planes (precios, límites, features) |
| `/admin/plantillas` | Listado de plantillas. Activar/desactivar (no editar código desde UI) |
| `/admin/billing` | Lista de invoices. Filtros: estado, vencimiento, tienda. Acciones: marcar pagada, cancelar, resending |
| `/admin/billing/cobranza` | Tiendas con pago vencido. Acciones masivas: enviar recordatorio, suspender |
| `/admin/analytics` | BI cross-tenant: gráficos de crecimiento, cohortes, MRR breakdown por plan, tiendas top por revenue |
| `/admin/auditoria` | Audit log de acciones críticas (suspensiones, impersonations, cambios de plan) |
| `/admin/configuracion` | Configuración global del SaaS: branding marketing site, T&C, política de privacidad |

#### 6.2.2 Funcionalidad: Impersonar tienda

- Botón "Ver como" en `/admin/tiendas/{id}`.
- Al hacer clic, crea sesión temporal de 1 hora con `actor_id = superAdmin.id` y `effective_role = STORE_OWNER`, redirige a `/dashboard`.
- Banner persistente arriba: "🔴 Estás impersonando a [Nombre Tienda] · [Salir]".
- Toda acción durante la impersonación queda en `AuditLog` con `actorId` real.
- "Salir" restaura sesión original.

#### 6.2.3 Mapa de calor global [MVP]

- En `/admin/analytics/heatmap`: heatmap de Bolivia con todos los pedidos.
- Filtros: rango de fechas, vertical, ciudad, plan.
- Permite identificar dónde se concentra demanda (útil para captar tiendas en zonas sub-atendidas).

#### 6.2.4 Métricas del dashboard global

Métricas a mostrar (gráficos con Recharts):

1. **MRR (Monthly Recurring Revenue)** en BOB.
2. **ARR (Annual Recurring Revenue)** en BOB.
3. **New MRR del mes**.
4. **Churned MRR del mes**.
5. **Net MRR Growth**.
6. **Total tiendas activas / trial / suspendidas**.
7. **Tiendas creadas (últimos 30 días)**.
8. **Churn rate %** (últimos 30 días).
9. **Pedidos totales del día** (sumados de todas las tiendas).
10. **GMV (Gross Merchandise Value) del día** — total de Bs procesados por todas las tiendas.
11. **Distribución por vertical** (donut).
12. **Distribución por plan** (donut).
13. **Top 10 tiendas por revenue** (tabla).
14. **Tiendas con 0 ventas en 14+ días** (lista de riesgo de churn).

#### 6.2.5 Criterios de aceptación

- [ ] Crear tienda en menos de 60 segundos desde `/admin/tiendas/nueva`.
- [ ] El owner recibe email de bienvenida con sus credenciales y enlace al dashboard.
- [ ] Impersonar funciona y deja audit log.
- [ ] Suspender una tienda inmediatamente bloquea el storefront público (muestra "Tienda suspendida").
- [ ] El heatmap renderiza con al menos 1.000 puntos sin lag.
- [ ] Exportar a Excel cualquier listado funciona en < 5s para 10k filas.

---

### 6.3 Módulo: Store Owner Dashboard

Ruta base: `/dashboard` 🔒 STORE_OWNER (algunas secciones también CASHIER)

#### 6.3.1 Páginas [MVP]

| Ruta | Funcionalidad | Cashier? |
|---|---|---|
| `/dashboard` | Home: pedidos del día, ventas del día, ranking productos, alertas (stock bajo, comprobantes por verificar) | ✅ |
| `/dashboard/pedidos` | Lista de pedidos. Filtros: estado, fecha, búsqueda por número/teléfono | ✅ |
| `/dashboard/pedidos/{id}` | Detalle: items, datos cliente, dirección con mapa, comprobante (si aplica), historial de eventos. Acciones: cambiar estado, agregar nota, editar items | ✅ |
| `/dashboard/productos` | Lista de productos con filtros (categoría, estado, stock). Bulk actions: activar/desactivar/eliminar | ❌ |
| `/dashboard/productos/nuevo` | Formulario crear producto | ❌ |
| `/dashboard/productos/{id}` | Editar producto, gestión de variantes e imágenes | ❌ |
| `/dashboard/productos/importar` | Importar CSV/Excel | ❌ |
| `/dashboard/categorias` | Árbol de categorías (drag para reordenar, anidar) | ❌ |
| `/dashboard/promociones/cupones` | CRUD cupones | ❌ |
| `/dashboard/promociones/banners` | CRUD banners (hero/secundario) | ❌ |
| `/dashboard/promociones/popups` | CRUD popups | ❌ |
| `/dashboard/clientes` | Lista de clientes de la tienda con stats (#pedidos, total gastado, último pedido). Filtros: nuevos, recurrentes, dormidos | ❌ |
| `/dashboard/delivery` | Configurar zonas (mapa con polígonos), tarifas, horarios | ❌ |
| `/dashboard/configuracion` | Branding (logo, colores, fuente), info de contacto, redes, horarios, QR de pago, métodos de pago habilitados | ❌ |
| `/dashboard/staff` | Gestionar cajeros (crear, desactivar) | ❌ |
| `/dashboard/analytics` | BI propio: ventas, productos top, clientes recurrentes, conversión, heatmap de pedidos por zona | ❌ |
| `/dashboard/billing` | Plan actual, próximas facturas, historial, cambiar plan (request) | ❌ |
| `/dashboard/exportar` | Exportar pedidos / clientes / productos a Excel | ❌ |

#### 6.3.2 Notificación tiempo real de pedidos ⚡

- En `/dashboard` y `/dashboard/pedidos`, abrir conexión SSE (`/api/dashboard/orders/stream`).
- Cada nuevo pedido (`status = NEW` o `PENDING_PAYMENT`):
  - Toast de notificación.
  - Sonido (campanita).
  - Badge en sidebar con conteo.
  - Browser notification si hay permiso (PWA).
- Configurable: el dueño puede silenciar sonido en preferencias.

#### 6.3.3 Criterios de aceptación

- [ ] El dueño puede crear un producto con 5 imágenes, 3 variantes, descripción rica, en menos de 3 minutos.
- [ ] Un nuevo pedido aparece en el dashboard del dueño en menos de 5 segundos.
- [ ] Cambiar estado de pedido se sincroniza inmediatamente al storefront del cliente (si tiene la página de tracking abierta).
- [ ] Importar 500 productos por CSV completa en menos de 60 segundos y muestra reporte de errores.
- [ ] Cashier no ve menús de productos/configuración, solo pedidos.

---

### 6.4 Módulo: Storefront público

Ruta base: `/{slug}` (storefront de cada tienda)

#### 6.4.1 Páginas [MVP]

| Ruta | Funcionalidad |
|---|---|
| `/{slug}` | Home: hero (banner principal), categorías destacadas, productos featured, info de la tienda, popup si aplica |
| `/{slug}/c/{categoria}` | Listado de productos por categoría con filtros (precio, etiquetas, disponibilidad) |
| `/{slug}/p/{producto}` | Detalle de producto: galería, descripción, variantes, agregar al carrito, productos relacionados |
| `/{slug}/buscar?q=` | Búsqueda en catálogo |
| `/{slug}/carrito` | Carrito (sidebar drawer + página) |
| `/{slug}/checkout` | Checkout 1-page mobile-first |
| `/{slug}/orden/{token}` | Tracking público de pedido (sin login) |
| `/{slug}/sobre-nosotros` | Página "Sobre nosotros" del comerciante |
| `/{slug}/contacto` | Datos de contacto + horarios + mapa |
| `/{slug}/politica-privacidad` | Genérica del SaaS, marcada con nombre de la tienda |
| `/{slug}/terminos` | Genérica del SaaS |

#### 6.4.2 Componentes claves

- **Header**: logo, búsqueda, carrito (con contador), login. Sticky en scroll.
- **Hero / Banner**: gestionado por `Banner` model.
- **Popup**: aparece según `Popup` configurado, con `delaySeconds`, `showOncePerSession`.
- **Categorías destacadas**: grilla de imágenes con overlay.
- **Productos featured**: carrusel.
- **Producto card**: imagen, nombre, precio (con tachado si aplica), badge ("Nuevo", "Best Seller"), botón rápido "Agregar".
- **Variantes selector**: dropdown o chips.
- **Galería de producto**: zoom, swipe en mobile.
- **Botón flotante**: ❌ NO botón de WhatsApp en MVP. Reemplazado por chatbot IA en planes con feature `aiChatbot = true`.
- **Footer**: redes sociales, info de contacto, horarios, métodos de pago, "Powered by [marca]" (si plan no tiene `removeWatermark`).

#### 6.4.3 Dark mode

- Detecta `prefers-color-scheme` automáticamente.
- Toggle manual disponible (almacena preferencia en localStorage).
- Cada plantilla define paleta light + dark.
- Si la tienda tiene `darkModeAllowed = false`, se desactiva (algunos comerciantes prefieren solo su brand).

#### 6.4.4 SEO [MVP]

- Cada storefront tiene su propio:
  - `<title>` con `metaTitle` o nombre de tienda.
  - Meta description.
  - Open Graph tags + imagen.
  - JSON-LD `Store` y `Product` schema.org.
- Sitemap dinámico en `/{slug}/sitemap.xml` (incluye home, categorías, productos activos).
- Robots.txt en `/robots.txt` global.
- Canonical URLs.
- ISR (Incremental Static Regeneration) para páginas de producto, revalidación cada 60s.

#### 6.4.5 Performance objetivo

- LCP < 2,5s en 3G boliviano simulado.
- CLS < 0,1.
- TTFB < 600ms.
- Imágenes con `next/image`, lazy loading, AVIF/WebP automático.
- Critical CSS inline, deferred non-critical.

#### 6.4.6 Criterios de aceptación

- [ ] El storefront carga en < 3s en conexión 3G.
- [ ] El popup respeta "1 vez por sesión".
- [ ] El cambio de variante actualiza precio sin reload.
- [ ] Agregar al carrito muestra confirmación visual y actualiza badge.
- [ ] La búsqueda devuelve resultados en < 500ms hasta 1k productos.

---

### 6.5 Módulo: Productos y Catálogo

#### 6.5.1 Funcionalidades [MVP]

- **CRUD de productos** con todos los campos del modelo.
- **Variantes**:
  - Hasta 50 variantes por producto.
  - Cada variante puede sobreescribir precio, stock, imagen.
  - Atributos libres (no enum) — el dueño decide nombres ("Tamaño", "Color", "Sabor").
- **Categorías y subcategorías**:
  - Árbol con drag & drop para reordenar y anidar.
  - Profundidad máxima recomendada: 3 niveles.
  - Categoría puede estar oculta (`isVisible = false`) sin eliminar.
- **Imágenes**:
  - Mín 1, máx 5 por producto.
  - Upload arrastrar y soltar.
  - Reorder por drag.
  - Procesamiento automático: resize a 1200x1200 max, WebP + fallback JPG, thumbnail 400x400.
- **Stock opcional**:
  - Toggle `manageStock` por producto.
  - Si activo: se descuenta al confirmar pedido (estado CONFIRMED), no al agregar al carrito.
  - Alerta de stock bajo configurable (`lowStockAlert`).
  - Si `stock = 0` y `manageStock = true`: se marca "Agotado" en storefront, no se puede agregar al carrito.
- **Horarios de disponibilidad**:
  - Para items que solo se venden ciertos días/horas (ej: desayunos 7–11 am).
  - Si fuera de horario: se muestra como "Disponible de X a Y" y no se puede agregar.
- **Etiquetas visuales**:
  - "Nuevo" (auto si creado hace < 14 días, override manual).
  - "Best Seller" (manual o auto si está en top 10 ventas últimos 30 días — calculado en cron).
  - Custom label con color (ej. "Solo hoy" en rojo).
- **Precio tachado**: si `comparePrice > basePrice`, se muestra precio anterior tachado.
- **Importación CSV/Excel**:
  - Plantilla descargable.
  - Columnas: SKU, Nombre, Categoría, Precio, Precio comparación, Stock, Manage Stock, Descripción, Imagen URL (opcional).
  - Validación previa con preview.
  - Reporte de errores fila por fila.
- **Productos digitales**: ⚠️ NO en MVP. Pendiente de definir flujo de entrega.

#### 6.5.2 Endpoints / Server Actions

```ts
// server/actions/product.actions.ts
createProductAction({ storeId, data: ProductInput }): Promise<Product>
updateProductAction({ id, data: Partial<ProductInput> }): Promise<Product>
deleteProductAction({ id }): Promise<void>
toggleProductActiveAction({ id }): Promise<void>
addProductImageAction({ productId, file: File }): Promise<ProductImage>
removeProductImageAction({ imageId }): Promise<void>
reorderProductImagesAction({ productId, ids: string[] }): Promise<void>
createVariantAction({ productId, data: VariantInput }): Promise<ProductVariant>
updateVariantAction({ id, data }): Promise<ProductVariant>
deleteVariantAction({ id }): Promise<void>
adjustStockAction({ productId | variantId, delta: number, reason: string }): Promise<void>

// Categorías
createCategoryAction({ storeId, data }): Promise<Category>
updateCategoryAction({ id, data }): Promise<Category>
deleteCategoryAction({ id }): Promise<void>
moveCategoryAction({ id, parentId, sortOrder }): Promise<void>

// Importación
parseImportFileAction({ storeId, file: File }): Promise<{ valid: ProductInput[], errors: ImportError[] }>
executeImportAction({ storeId, products: ProductInput[] }): Promise<{ created: number, updated: number }>
```

#### 6.5.3 Criterios de aceptación

- [ ] Crear producto con variantes y 5 imágenes funciona en < 30s incluyendo upload.
- [ ] Variante con stock 0 no puede agregarse al carrito.
- [ ] Producto fuera de horario muestra mensaje claro y botón deshabilitado.
- [ ] Importar CSV de 200 productos completa en < 30s y muestra resumen.
- [ ] Reordenar imágenes por drag se persiste tras reload.

---

### 6.6 Módulo: Promociones

#### 6.6.1 Cupones [MVP]

- Tipos: `PERCENTAGE` (% off), `FIXED_AMOUNT` (Bs off), `FREE_SHIPPING`.
- Configuración:
  - Código (único por tienda, ej: `BIENVENIDO10`).
  - Vigencia (`validFrom` / `validTo`).
  - Monto mínimo de pedido para aplicar.
  - Descuento máximo (cap para % grandes).
  - Límite de uso total y por usuario.
- Aplicación en checkout: el cliente ingresa el código y se valida vía Server Action.
- Cupones expirados o sin stock se rechazan con mensaje claro.

#### 6.6.2 Banners [MVP]

- 2 posiciones: `hero` (banner principal) y `secondary` (sección extra del home).
- Imagen desktop + mobile separadas (responsive).
- Link opcional (a categoría, producto, URL externa).
- Vigencia opcional (banner que aparece solo en promo de Black Friday, etc.).
- Hasta 5 banners hero rotando en carrusel automático cada 5s.

#### 6.6.3 Popups [MVP]

- Aparecen al entrar al storefront según `delaySeconds` (default 3s).
- `showOncePerSession = true` por default (cookie/localStorage `popup_seen_{popupId}`).
- Componentes: título, mensaje rich text, imagen opcional, CTA (texto + URL).
- El cliente puede cerrar con X (siempre visible) o clic fuera.
- Vigencia opcional.
- Solo 1 popup activo por tienda a la vez (regla de validación al guardar).

#### 6.6.4 Etiquetas visuales en productos

Ya cubierto en §6.5: `isNew`, `isBestSeller`, `customLabel`. Las etiquetas se muestran en product cards y en página de detalle como badges con color configurable.

#### 6.6.5 Endpoints / Server Actions

```ts
// Cupones
createCouponAction({ storeId, data }): Promise<Coupon>
updateCouponAction({ id, data }): Promise<Coupon>
deleteCouponAction({ id }): Promise<void>
validateCouponAction({ storeId, code, cartTotal, customerId? }): Promise<{ valid: boolean, discount: number, error?: string }>

// Banners
createBannerAction({ storeId, data, image: File, mobileImage?: File }): Promise<Banner>
updateBannerAction({ id, data }): Promise<Banner>
deleteBannerAction({ id }): Promise<void>
reorderBannersAction({ storeId, ids: string[] }): Promise<void>

// Popups
createPopupAction({ storeId, data, image?: File }): Promise<Popup>
updatePopupAction({ id, data }): Promise<Popup>
deletePopupAction({ id }): Promise<void>
togglePopupActiveAction({ id }): Promise<void>
```

#### 6.6.6 Criterios de aceptación

- [ ] Cupón `PERCENTAGE` aplica correctamente y respeta `maxDiscountAmount`.
- [ ] Cupón fuera de vigencia muestra error claro.
- [ ] Popup no reaparece tras cerrarlo en la misma sesión (incluye refresh).
- [ ] Banner mobile se muestra solo en viewport < 768px.

---

### 6.7 Módulo: Carrito y Checkout

#### 6.7.1 Carrito [MVP]

- **Persistente**:
  - Para guests: cookie `guest_token` + registro en DB `Cart`. Expira en 7 días.
  - Para customers logueados: vinculado a `customerId`. Sincroniza al loguear (merge de carrito guest si existe).
- **Operaciones**:
  - Agregar producto (con variante y notas opcionales).
  - Cambiar cantidad.
  - Eliminar item.
  - Aplicar/quitar cupón.
  - Limpiar carrito.
- **UX**:
  - Drawer lateral con resumen (slide-in al agregar).
  - Página `/{slug}/carrito` para revisión completa.
  - Cálculo en vivo de subtotal, descuento, envío estimado, total.
- **Validaciones**:
  - Si producto/variante se desactivó o quedó sin stock, se muestra warning y se deshabilita.
  - Si cambió el precio, se recalcula al checkout (snapshot al momento de crear orden).

#### 6.7.2 Checkout [MVP]

Un solo formulario tipo "stepper" o "long form" mobile-first:

**Sección 1: Datos de contacto**
- Nombre completo (requerido).
- Teléfono +591 (requerido, validación formato).
- Email (opcional).
- Si está logueado, prefilled.
- Si no está logueado: opción al final "Crear cuenta para próximas compras" (checkbox + password).

**Sección 2: Entrega**
- Toggle: Delivery / Recoger en tienda (`pickup`) si tienda lo permite.
- Si Delivery:
  - **Mapa interactivo (Leaflet + OSM)** centrado en ciudad de la tienda.
  - El cliente arrastra un pin O permite "usar mi ubicación" (geolocation API).
  - Campo dirección texto libre (autocomplete con Nominatim si lat/lng definidos).
  - Campo "Aclaración / Referencia" (ej: "frente al kiosco azul, 2do piso").
  - Si tienda tiene zonas configuradas: detecta zona del pin → muestra costo de envío.
  - Si fuera de zonas: mensaje "Fuera de zona — el costo se confirmará por WhatsApp" (no bloquea checkout).

**Sección 3: Método de pago**
- Radio buttons:
  - **QR** (si `acceptsQR = true`):
    - Muestra imagen del QR del comerciante.
    - Botón "Descargar QR".
    - Instrucciones (`qrInstructions`).
    - **Upload obligatorio del comprobante** (imagen, máx 5MB).
  - **Contra entrega** (si `acceptsCashOnDelivery = true`):
    - No requiere acción adicional.
- Cupón: campo para ingresar código.

**Sección 4: Resumen y confirmar**
- Lista de items, subtotal, descuento, envío, total.
- Notas adicionales del pedido (textarea).
- Botón **"Confirmar pedido y avisar por WhatsApp"**.

#### 6.7.3 Flujo al confirmar pedido

```
1. Cliente clic "Confirmar pedido y avisar por WhatsApp"
2. Server Action createOrderAction valida todo:
   - Stock disponible (si aplica)
   - Cupón vigente
   - Comprobante subido (si pago QR)
   - Datos completos
3. Crea Order en DB con status:
   - PENDING_PAYMENT si QR (esperando verificación)
   - NEW si contra entrega
4. Genera trackingToken único.
5. Genera mensaje de WhatsApp formateado (ver §6.10).
6. Devuelve al cliente:
   - URL de tracking: /{slug}/orden/{token}
   - Link wa.me con mensaje pre-cargado.
7. Cliente es redirigido a "Pedido confirmado" donde:
   - Botón GRANDE "Avisar por WhatsApp" (abre wa.me).
   - Resumen del pedido.
   - Link a tracking.
8. Server emite evento al dueño vía SSE → notificación tiempo real en /dashboard.
```

#### 6.7.4 Endpoints / Server Actions

```ts
// Carrito
addToCartAction({ storeId, productId, variantId?, quantity, notes? }): Promise<Cart>
updateCartItemAction({ cartItemId, quantity, notes? }): Promise<Cart>
removeFromCartAction({ cartItemId }): Promise<Cart>
applyCouponToCartAction({ cartId, code }): Promise<Cart>
removeCouponFromCartAction({ cartId }): Promise<Cart>
clearCartAction({ cartId }): Promise<void>
mergeCartsOnLoginAction({ guestCartId, customerId }): Promise<Cart>

// Checkout
calculateCheckoutAction({ cartId, addressLat?, addressLng? }): Promise<CheckoutSummary>
createOrderAction({ cartId, checkoutData }): Promise<{ order, trackingUrl, whatsappLink }>
```

#### 6.7.5 Criterios de aceptación

- [ ] Carrito persiste tras cerrar pestaña (7 días).
- [ ] Carrito de guest se merge al loguear sin perder items.
- [ ] Si el pin está dentro de una zona, costo de envío se muestra automáticamente.
- [ ] No se puede confirmar pedido QR sin comprobante.
- [ ] Crear pedido devuelve link wa.me funcional con mensaje completo.
- [ ] Al volver al storefront tras pedido, el carrito está vacío.

---

### 6.8 Módulo: Pagos

#### 6.8.1 QR Estático [MVP]

- El dueño sube **una imagen** de su QR (de banco o billetera digital) en `/dashboard/configuracion`.
- El QR se almacena como cualquier imagen (procesado con sharp).
- Campo opcional `qrInstructions` (ej: "Una vez pagado, sube el comprobante. Tu pedido se confirmará en máx 30 minutos").
- En checkout: se muestra la imagen del QR + instrucciones + uploader de comprobante.
- El cliente paga fuera del sitio (escaneando con su app bancaria).
- Sube comprobante (foto del recibo o screenshot).
- Pedido entra como `PENDING_PAYMENT` + `paymentStatus = AWAITING_VERIFICATION`.

#### 6.8.2 Verificación manual del comprobante [MVP]

- En `/dashboard/pedidos/{id}` el dueño ve la imagen del comprobante.
- 3 acciones:
  - **Verificar**: marca `paymentStatus = VERIFIED`, status del pedido pasa de `PENDING_PAYMENT` a `NEW` (o directamente a `CONFIRMED` si el dueño así lo elige).
  - **Rechazar**: requiere razón. `paymentStatus = REJECTED`, notifica al cliente (vía WhatsApp manual + en tracking page).
  - **Pedir nuevo comprobante**: vuelve a `PENDING_PAYMENT`, cliente recibe link para resubir.

#### 6.8.3 QR Dinámico [V2 / Plan Business]

- Integración con BNB API Market o Pay-me Bolivia.
- Genera QR único por pedido con monto exacto.
- Webhook del banco confirma pago automáticamente → pedido pasa a `NEW` sin verificación manual.
- **Reduce trabajo del dueño**, justifica precio premium.
- Endpoints:
  ```
  POST /api/payments/bnb/webhook
  POST /api/payments/payme/webhook
  ```

#### 6.8.4 Contra entrega [MVP]

- `acceptsCashOnDelivery` toggle por tienda.
- Si activo, opción visible en checkout.
- Pedido entra como `NEW` directo (sin esperar pago).
- `paymentStatus = PENDING` hasta que dueño marque como cobrado al entregar (cambia a `VERIFIED` al entregar).

#### 6.8.5 Endpoints / Server Actions

```ts
verifyPaymentAction({ orderId, decision: 'APPROVE' | 'REJECT' | 'REQUEST_NEW', reason? }): Promise<Order>
uploadPaymentProofAction({ orderId, file: File }): Promise<Order>  // por cliente
```

#### 6.8.6 Criterios de aceptación

- [ ] El QR del dueño se muestra correctamente en checkout (sin distorsión).
- [ ] Subir comprobante (img < 5MB) funciona y queda asociado al pedido.
- [ ] Verificar comprobante actualiza estado y dispara evento.
- [ ] Rechazar comprobante notifica al cliente con razón.
- [ ] Toggle de "contra entrega" oculta la opción en checkout en < 1s.

---

### 6.9 Módulo: Pedidos

#### 6.9.1 Estados (FSM)

```
       ┌──────────────────┐
       │ PENDING_PAYMENT  │ (solo si QR sin verificar)
       └────────┬─────────┘
                │ (verificar comprobante)
                ▼
       ┌──────────────────┐
   ┌──▶│       NEW        │
   │   └────────┬─────────┘
   │            │ (dueño confirma)
   │            ▼
   │   ┌──────────────────┐
   │   │   CONFIRMED      │
   │   └────────┬─────────┘
   │            │
   │            ▼
   │   ┌──────────────────┐
   │   │   PREPARING      │
   │   └────────┬─────────┘
   │            │
   │            ▼
   │   ┌──────────────────┐
   │   │   IN_DELIVERY    │
   │   └────────┬─────────┘
   │            │
   │            ▼
   │   ┌──────────────────┐
   │   │   DELIVERED      │ (final)
   │   └──────────────────┘
   │
   │   (cualquier estado puede ir a CANCELLED)
   │   ┌──────────────────┐
   └──▶│   CANCELLED      │ (final)
       └──────────────────┘
```

#### 6.9.2 Funcionalidades [MVP]

- **Listado de pedidos** con filtros y búsqueda.
- **Detalle del pedido** con:
  - Items (con imágenes).
  - Totales.
  - Datos del cliente.
  - Dirección con mapa.
  - Comprobante (si aplica).
  - Historial completo (`OrderEvent[]`).
  - Notas internas (solo dueño/cajero).
- **Cambio de estado** con un clic (botones contextuales).
- **Edición del pedido** (solo dueño, no cajero):
  - Agregar items adicionales (si cliente pide algo más por WhatsApp).
  - Quitar items.
  - Recalcular total.
  - Cada cambio queda registrado en `OrderEvent`.
- **Cancelación** con razón obligatoria.
- **Tracking público** en `/{slug}/orden/{token}` (sin login):
  - Estado actual con timeline visual.
  - Items y total.
  - Datos de entrega.
  - Sin información sensible (no muestra notas internas).
- **Historial por cliente** en `/dashboard/clientes/{id}`: lista de todos los pedidos.
- **Notificación tiempo real al dueño** ⚡ (ver §6.3.2).
- **Numeración**: cada tienda tiene su propia secuencia (`Order.orderNumber` empieza en 1 por tienda).

#### 6.9.3 Endpoints / Server Actions

```ts
listOrdersAction({ storeId, filters }): Promise<Order[]>
getOrderAction({ id }): Promise<OrderWithItems>
getOrderByTrackingTokenAction({ token }): Promise<PublicOrderView>
changeOrderStatusAction({ orderId, newStatus, note? }): Promise<Order>
addItemToOrderAction({ orderId, productId, variantId?, quantity, notes? }): Promise<Order>
removeItemFromOrderAction({ orderItemId }): Promise<Order>
addOrderNoteAction({ orderId, note, isInternal: boolean }): Promise<Order>
cancelOrderAction({ orderId, reason }): Promise<Order>
streamNewOrders(storeId): SSE  // /api/dashboard/orders/stream
```

#### 6.9.4 Criterios de aceptación

- [ ] Cambiar estado registra evento con `byUserId`, `byUserName`, timestamp.
- [ ] Al pasar a `CONFIRMED`, si producto tiene `manageStock`, se descuenta stock.
- [ ] Al `CANCELLED` desde `CONFIRMED+`, se restaura stock.
- [ ] Tracking público es accesible solo con token correcto (no enumerable).
- [ ] El dueño ve sonido + badge cuando entra pedido nuevo en < 5s.

---

### 6.10 Módulo: Integración WhatsApp [MVP]

#### 6.10.1 Modelo: link wa.me (cliente envía manualmente)

No usamos WhatsApp Business API en MVP. El flujo es:

```
1. Cliente confirma pedido en checkout.
2. Sistema genera mensaje formateado.
3. Cliente recibe pantalla "Pedido confirmado" con botón gigante:
   "📲 Avisar a [nombre tienda] por WhatsApp"
4. Botón abre wa.me/{whatsappPhone}?text={mensaje URL-encoded}
5. WhatsApp del cliente abre con todo precargado.
6. Cliente toca "Enviar".
7. Pedido ya está en sistema del dueño (notificación SSE).
```

**Importante**: el pedido se crea en sistema **antes** del envío del WhatsApp. Si el cliente no envía el mensaje, el dueño igual ve el pedido en su dashboard (con indicador "WhatsApp aún no enviado").

#### 6.10.2 Formato del mensaje (template)

```
🛒 *NUEVO PEDIDO #{orderNumber}*
━━━━━━━━━━━━━━━━━━━━

👤 *Cliente:* {customerName}
📞 {customerPhone}

📍 *Entrega:*
{deliveryAddress}
{deliveryNote ? `Ref: ${deliveryNote}` : ''}

🛍️ *Productos:*
{items.map(i => `• ${i.quantity}× ${i.productName}${i.variantName ? ` (${i.variantName})` : ''} — Bs ${i.subtotal}${i.notes ? `\n   _${i.notes}_` : ''}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━
Subtotal: Bs {subtotal}
{discountAmount > 0 ? `Descuento (${couponCode}): -Bs ${discountAmount}` : ''}
{deliveryFee ? `Envío: Bs ${deliveryFee}` : ''}
*TOTAL: Bs {total}*

💳 *Pago:* {paymentMethod === 'QR_STATIC' ? 'QR (comprobante adjunto en sistema)' : 'Contra entrega'}

{customerNotes ? `📝 *Notas:* ${customerNotes}` : ''}

━━━━━━━━━━━━━━━━━━━━
🔗 Ver en panel: {APP_URL}/dashboard/pedidos/{orderId}
🔗 Cliente trackea en: {APP_URL}/{slug}/orden/{trackingToken}
```

URL-encoding adecuado para wa.me. Helper:

```ts
// lib/whatsapp/format.ts
export function buildWhatsAppLink(order: OrderWithItems, store: Store, appUrl: string): string {
  const message = renderTemplate(order, store, appUrl)
  const encoded = encodeURIComponent(message)
  const phone = store.whatsappPhone.replace(/\D/g, '')  // sin '+' ni espacios
  return `https://wa.me/${phone}?text=${encoded}`
}
```

#### 6.10.3 Confirmación al cliente

En MVP el dueño escribe manualmente al cliente por WhatsApp para confirmar/coordinar (igual que hoy hacen). El sistema le da:
- Teléfono del cliente con un clic para abrir wa.me.
- Plantillas pre-redactadas en `/dashboard/pedidos/{id}` (botones rápidos):
  - "Confirmar recepción"
  - "Pedido en camino"
  - "Llegué"
  - "Recibido, gracias"

#### 6.10.4 Criterios de aceptación

- [ ] El link wa.me se abre correctamente en mobile y desktop.
- [ ] El mensaje incluye TODOS los items con notas, totales y links al panel + tracking.
- [ ] Si `customerNotes` está vacío, no aparece la sección "Notas" (sin líneas en blanco).
- [ ] Caracteres especiales (acentos, emojis) se URL-encodean bien.

---

### 6.11 Módulo: Chatbot IA [V2 / Plan Business]

#### 6.11.1 Scope

Reemplaza el botón flotante de WhatsApp. **No es MVP**, pero el modelo de datos y los hooks ya están en MVP para no romper migración.

- Widget flotante en cada storefront (esquina inferior derecha).
- El visitante hace preguntas en lenguaje natural sobre:
  - Productos y precios ("¿Tienen pizza margarita? ¿Cuánto cuesta?").
  - Horarios ("¿A qué hora cierran?").
  - Métodos de pago.
  - Zonas de delivery.
  - Estado del pedido si da número + teléfono.
- El bot responde basado en el catálogo y configuración de la tienda (RAG sobre Postgres + cache).
- Si no sabe responder: ofrece link wa.me al dueño.

#### 6.11.2 Stack [V2]

- **LLM**: OpenAI `gpt-4o-mini` (más barato y suficiente).
- **RAG**: embeddings de productos + configuración guardados en Postgres con `pgvector`.
- **Costo controlado**: máx 20 mensajes por sesión por visitante. Cache de respuestas frecuentes.

#### 6.11.3 Configuración por dueño

- Toggle activar/desactivar.
- Mensaje de bienvenida personalizable.
- Tono (formal / casual / divertido).
- Preguntas frecuentes pre-cargadas.

#### 6.11.4 Diferimiento

⚠️ **Marca clara**: Esto es complejidad alta y costo recurrente OpenAI. Se entrega en V2 como diferenciador del plan Business. En MVP, el storefront muestra un botón "Ayuda" simple que abre wa.me al dueño (no chatbot IA aún).

---

### 6.12 Módulo: Notificaciones

#### 6.12.1 Canales

| Canal | A quién | Cuándo | MVP? |
|---|---|---|---|
| In-app SSE | Store Owner / Cashier | Nuevo pedido, comprobante subido | ✅ |
| Browser notification | Store Owner / Cashier | Si concede permiso | ✅ |
| Sonido | Store Owner / Cashier | Nuevo pedido | ✅ |
| Email | Store Owner | Recovery, factura emitida, factura vencida | ✅ |
| Email | Super Admin | Tienda registrada, factura impaga, churn detectado | ✅ |
| WhatsApp wa.me | Cliente → Store Owner | Pedido confirmado | ✅ (manual) |
| WhatsApp Business API | Sistema → Cliente | Confirmaciones automáticas | ❌ V3 |

#### 6.12.2 Email templates (con Tiptap o MJML)

- `welcome-store-owner.html` — bienvenida al crear tienda.
- `password-reset.html`
- `invoice-issued.html`
- `invoice-due-soon.html` (3 días antes)
- `invoice-overdue.html`
- `store-suspended.html`
- `customer-account-created.html`

#### 6.12.3 Preferencias del Store Owner

En `/dashboard/configuracion/notificaciones`:
- ☑ Sonido al recibir pedido
- ☑ Notificación del navegador
- ☑ Email de resumen diario de ventas (próximas)
- ☑ Email de alertas de stock bajo

---

### 6.13 Módulo: Plantillas / Temas

#### 6.13.1 Las 5 plantillas verticales [MVP]

Cada plantilla es un conjunto de componentes React + paleta default + layout específico para ese vertical. Se almacenan en `templates/{vertical}/` y se resuelven por `Store.template.componentKey`.

| Vertical | `componentKey` | Características visuales |
|---|---|---|
| Restaurante | `restaurant_v1` | Grid grande de fotos de platos, categorías como tabs (Entradas, Principales, Bebidas, Postres), card con descripción + precio + botón "Agregar". Modal de variantes (tamaños). Indicador de horarios de cocina |
| Food Truck | `food_truck_v1` | One-page, menú scroll vertical, branding callejero (tipografías más fuertes, colores saturados), ubicación destacada en home |
| Retail | `retail_v1` | Grid de producto tipo e-commerce clásico, filtros laterales (categoría, precio, etiquetas), galería de producto con zoom |
| Ferretería | `hardware_v1` | Categorías profundas en sidebar, búsqueda prominente, foco en SKU y stock visible, tablas de variantes (medidas) |
| Servicios | `services_v1` | Cards de servicios en lugar de productos, sin variantes, foco en descripción larga + CTA "Reservar/Cotizar" → mensaje WhatsApp |

#### 6.13.2 Personalización [CONFIGURABLE] [MVP]

En `/dashboard/configuracion`, el dueño puede editar (panel de campos, NO drag-drop):

- **Identidad**: logo (PNG/SVG, max 2MB), favicon, banner principal.
- **Colores**: primario, secundario, acento. Picker visual + input hex.
- **Tipografía**: dropdown con 8 opciones curadas (Inter, Poppins, Montserrat, Roboto, Lato, Open Sans, Playfair, DM Sans).
- **Plantilla**: el dueño puede cambiar entre las 5 (efecto inmediato, sin pérdida de datos).
- **Sobre nosotros**: texto rich (Tiptap).
- **Datos de contacto**: dirección física, teléfono, email, horarios.
- **Redes sociales**: IG, FB, TikTok, web propia.
- **Modo oscuro**: toggle "Permitir modo oscuro automático" (default ON).
- **Pie de página**: textos personalizables + métodos de pago aceptados.

Configuración avanzada (solo plan Business / V2): CSS personalizado.

#### 6.13.3 Implementación técnica

```ts
// app/[slug]/page.tsx
import { resolveStore } from '@/lib/tenant/resolve'
import { getTemplate } from '@/templates'

export default async function StorefrontHome({ params }: { params: { slug: string } }) {
  const store = await resolveStore(params.slug)
  const Template = getTemplate(store.template.componentKey)
  return <Template.Home store={store} />
}

// templates/index.ts
import * as restaurant from './restaurant/v1'
import * as foodTruck from './food-truck/v1'
import * as retail from './retail/v1'
import * as hardware from './hardware/v1'
import * as services from './services/v1'

const templates = {
  restaurant_v1: restaurant,
  food_truck_v1: foodTruck,
  retail_v1: retail,
  hardware_v1: hardware,
  services_v1: services,
}

export function getTemplate(key: string) {
  return templates[key] ?? templates.retail_v1
}
```

Cada plantilla expone: `Home`, `ProductDetail`, `CategoryListing`, `Cart`, `Checkout`, `OrderTracking`. El layout y estilos viven dentro de cada carpeta de plantilla.

#### 6.13.4 Sistema de design tokens

Cada plantilla declara CSS variables que se inyectan según el `Store`:

```css
/* templates/restaurant/v1/theme.css */
:root[data-store-theme="restaurant"] {
  --color-primary: var(--store-primary, #DC2626);
  --color-secondary: var(--store-secondary, #FBBF24);
  --font-heading: var(--store-font, 'Poppins'), sans-serif;
  --radius-card: 1rem;
}
```

```tsx
// Layout del storefront
<html data-store-theme={store.template.vertical.toLowerCase()}>
  <body style={{
    '--store-primary': store.primaryColor,
    '--store-secondary': store.secondaryColor,
    '--store-accent': store.accentColor,
    '--store-font': store.fontFamily,
  } as CSSProperties}>
```

#### 6.13.5 Criterios de aceptación

- [ ] Cambiar de plantilla `restaurant_v1` a `retail_v1` se aplica sin pérdida de productos.
- [ ] Cambiar color primario actualiza todos los CTAs en < 1 reload.
- [ ] Cargar logo SVG no rompe el render.
- [ ] El selector de plantilla muestra preview de cada una.

---

### 6.14 Módulo: Analytics & BI

#### 6.14.1 Filosofía

> "Como un experto en BI, todos los datos profesionales que necesita esta empresa".

Dos audiencias separadas con dashboards distintos:

1. **Super Admin (BI cross-tenant)**: salud del SaaS — MRR, churn, growth, GMV agregado, cohortes, heatmap geográfico global.
2. **Store Owner (BI propio)**: salud de su tienda — ventas, productos top, clientes recurrentes, conversión, heatmap geográfico de sus pedidos.

#### 6.14.2 Dashboard del Store Owner

Ruta: `/dashboard/analytics`. Tabs:

**Tab 1: Resumen**
- KPIs hero (4 cards):
  - Pedidos hoy / ayer / esta semana / mes (con delta % vs período anterior).
  - Ventas hoy (Bs) / mes (Bs).
  - Ticket promedio.
  - Conversión (visitantes únicos → pedidos completados).
- Gráfico línea: ventas últimos 30 días (filtros: 7d, 30d, 90d, custom).
- Gráfico barras: pedidos por día de la semana.
- Distribución por método de pago (donut: QR vs Contra entrega).
- Distribución por estado actual (donut).

**Tab 2: Productos**
- Top 10 productos más vendidos (tabla con: nombre, cantidad, revenue, ticket promedio).
- Top 10 productos por revenue.
- Productos sin ventas en últimos 30 días (alerta).
- Stock bajo (productos con `stock <= lowStockAlert`).
- Categorías top (revenue por categoría).
- Mix de variantes vendidas.

**Tab 3: Clientes**
- Total clientes / nuevos este mes / recurrentes.
- Tasa de recurrencia (% de clientes con > 1 pedido).
- LTV (Customer Lifetime Value) promedio.
- Top 20 clientes por gasto total.
- Cohorte mensual de retención.
- Lista de clientes inactivos > 60 días (oportunidad de remarketing).

**Tab 4: Mapa de calor [MVP DESTACADO]**
- Mapa de la ciudad principal con heatmap de pedidos (último 30/90/365 días, configurable).
- Filtros: rango de fechas, vertical, estado del pedido.
- Toggle: mostrar pins individuales / heatmap / ambos.
- Insight automático: "El 60% de tus pedidos viene de la zona X — considerá ofrecer envío gratis ahí".
- Implementación: Leaflet + leaflet.heat sobre coordenadas de `Order.deliveryLat/Lng`.

**Tab 5: Embudo de conversión**
- Visitantes únicos → vieron producto → agregaron al carrito → iniciaron checkout → completaron pedido.
- Drop-off rate por paso.
- Comparación período anterior.

**Tab 6: Promociones**
- Performance de cada cupón: usos, descuento total dado, revenue generado, ROI.
- Comparativo de pedidos con vs sin cupón.

#### 6.14.3 Dashboard del Super Admin

Ruta: `/admin/analytics`. Tabs:

**Tab 1: Salud del SaaS**
- MRR / ARR / Net New MRR / Churn MRR.
- Distribución MRR por plan (stacked bar).
- Trial → Active conversion rate.
- Activation rate (% tiendas con primer pedido en < 7 días).
- Quick ratio (Net New MRR / Churn MRR).

**Tab 2: Crecimiento**
- Tiendas registradas por semana/mes (línea).
- Cohortes de retención (heatmap clásico de cohortes).
- LTV / CAC ratio (CAC manual al inicio, post-MVP automatizado).

**Tab 3: GMV agregado**
- GMV total del SaaS (suma de todos los pedidos completados).
- Take rate (si en V3 se cobra comisión por transacción).
- Top 20 tiendas por GMV.
- Distribución GMV por vertical.

**Tab 4: Mapa de calor global**
- Heatmap nacional de Bolivia con todos los pedidos.
- Filtros: vertical, plan, rango de fechas.
- Identifica zonas con alta demanda y baja oferta de tiendas (oportunidad de venta).

**Tab 5: Operaciones**
- Tiempo promedio de verificación de comprobante (por tienda).
- Tiempo promedio NEW → DELIVERED.
- Tasa de cancelación.
- Tiendas con mayor tasa de rechazo de pago (potencial fraude).

#### 6.14.4 Implementación

- **Cálculos pesados**: pre-agregar en jobs nocturnos a tabla `MetricSnapshot` para no calcular en cada visita.
- **Live data** (hoy, esta semana): query directa con índices.
- **Charts**: Recharts para charts simples, Apache ECharts para heatmap y gráficos complejos.
- **Mapas**: Leaflet + leaflet.heat (CDN o npm).

#### 6.14.5 Endpoints / Server Actions

```ts
// Store Owner
getStoreOverviewMetricsAction({ storeId, range }): Promise<OverviewMetrics>
getStoreProductMetricsAction({ storeId, range }): Promise<ProductMetrics>
getStoreCustomerMetricsAction({ storeId, range }): Promise<CustomerMetrics>
getStoreHeatmapDataAction({ storeId, range }): Promise<{ lat: number, lng: number, weight: number }[]>
getStoreFunnelAction({ storeId, range }): Promise<FunnelMetrics>

// Super Admin
getSaasHealthMetricsAction(): Promise<SaasHealthMetrics>
getSaasGrowthMetricsAction({ range }): Promise<GrowthMetrics>
getSaasGmvMetricsAction({ range }): Promise<GmvMetrics>
getGlobalHeatmapDataAction({ filters }): Promise<HeatmapPoint[]>
```

#### 6.14.6 Criterios de aceptación

- [ ] Todos los charts cargan en < 2s para tiendas con hasta 10k pedidos.
- [ ] Heatmap renderiza 1.000 puntos sin lag perceptible.
- [ ] Cambio de rango de fechas refresca todos los charts del tab.
- [ ] Insight automático del heatmap se calcula con regla heurística clara y se cita la zona.
- [ ] Tooltip de cualquier dato muestra valor exacto + comparación vs período anterior.

---

### 6.15 Módulo: Billing del SaaS

#### 6.15.1 Modelo de negocio

- **Trial**: 30 días gratis al crear tienda. `Store.status = TRIAL`.
- **Planes** (precios placeholder, ajustar al lanzar):

| Plan | Mensual (Bs) | Anual (Bs) | Productos | Pedidos/mes | Staff | Features destacadas |
|---|---|---|---|---|---|---|
| Starter | 0 | 0 | 30 | 50 | 1 | Solo subdominio path, watermark "Powered by", soporte comunidad |
| Pro | 99 | 990 (-17%) | 500 | 500 | 3 | Sin watermark, soporte email, importación CSV |
| Business | 249 | 2490 (-17%) | Ilimitado | Ilimitado | 10 | QR dinámico, chatbot IA, analytics avanzado, soporte prioritario |

Precios anclados en BOB (sin USD para evitar volatilidad cambiaria local).

#### 6.15.2 Ciclo de facturación [MVP]

```
Día 0:    Tienda creada → status = TRIAL, trialEndsAt = +30d
Día 30:   Trial termina. Sistema envía email "Tu prueba gratuita terminó".
          Si no hay método de pago confirmado → status = PAST_DUE.
Día 31:   Genera primera Invoice con dueDate = +7d.
Día 35:   Recordatorio email (3 días antes de vencimiento).
Día 38:   Día de vencimiento. Email final.
Día 39+:  Si Invoice sigue PENDING → status = OVERDUE.
Día 43:   Período de gracia 5 días. Email crítico.
Día 44:   Si sigue impaga → Store.status = SUSPENDED automáticamente.
          Storefront público bloqueado. Dashboard muestra "Reactivar".
```

#### 6.15.3 Cómo se cobra al merchant [MVP]

⚠️ **MVP simple, no automatizado completo**:

- El dueño recibe la Invoice por email + visible en `/dashboard/billing`.
- Modos de pago:
  - Transferencia bancaria a cuenta del SaaS.
  - QR del SaaS (mismo modelo que las tiendas usan con sus clientes).
- El dueño sube el comprobante en `/dashboard/billing/invoices/{id}/pagar`.
- El **Super Admin verifica manualmente** desde `/admin/billing` y marca como `PAID`.
- El sistema genera la siguiente Invoice automáticamente al inicio del próximo ciclo.

**V2**: integrar Pay-me Cybersource para cobro recurrente con tarjeta, evitando trabajo manual.

#### 6.15.4 Generación automática de invoices

Cron job diario (`/api/cron/generate-invoices`):

1. Para cada tienda activa cuyo `nextInvoiceAt <= today`:
   - Crear Invoice con monto del plan según `billingCycle`.
   - `dueDate = today + 7d`.
   - `periodStart = today`, `periodEnd = today + 30d` (o +365d si yearly).
   - Enviar email "Nueva factura".
   - Actualizar `Store.nextInvoiceAt = today + 30d` (o +365d).

#### 6.15.5 Suspensión automática

Cron job diario (`/api/cron/suspend-overdue`):

1. Para cada Invoice con `status = OVERDUE` y `dueDate < today - 5d`:
   - `Store.status = SUSPENDED`.
   - `Store.suspendedAt = now()`.
   - `Store.suspendedReason = 'Factura impaga'`.
   - Enviar email crítico al dueño.
   - Log en `AuditLog`.

#### 6.15.6 Reactivación

- Dueño paga la Invoice atrasada (sube comprobante).
- Super Admin verifica.
- Sistema automáticamente: `Store.status = ACTIVE`, `suspendedAt = null`.

#### 6.15.7 Cambio de plan

- Dueño solicita upgrade desde `/dashboard/billing`.
- Si es upgrade: prorrateo del período actual + ajuste en próxima factura.
- Si es downgrade: efecto al final del período actual.
- Restricciones automáticas: si downgrade, validar que cumple los nuevos límites (productos, staff). Si no, error con CTA "Reduce primero".

#### 6.15.8 Endpoints / Server Actions

```ts
// Store Owner
listMyInvoicesAction({ storeId }): Promise<Invoice[]>
getInvoiceAction({ invoiceId }): Promise<Invoice>
uploadInvoicePaymentProofAction({ invoiceId, file }): Promise<Invoice>
requestPlanChangeAction({ storeId, newPlanId, cycle }): Promise<void>

// Super Admin
listAllInvoicesAction({ filters }): Promise<Invoice[]>
verifyInvoicePaymentAction({ invoiceId, decision, note? }): Promise<Invoice>
suspendStoreAction({ storeId, reason }): Promise<void>
reactivateStoreAction({ storeId }): Promise<void>
generateInvoiceManuallyAction({ storeId, customAmount? }): Promise<Invoice>

// Cron
runGenerateInvoicesJob(): Promise<void>
runSuspendOverdueJob(): Promise<void>
runSendRemindersJob(): Promise<void>
```

#### 6.15.9 Criterios de aceptación

- [ ] Trial dura exactamente 30 días desde creación de tienda.
- [ ] Invoice se genera automáticamente al final de cada período sin intervención manual.
- [ ] Recordatorios se envían 3 días y 1 día antes del vencimiento.
- [ ] Suspensión automática a los 5 días post-vencimiento.
- [ ] Storefront de tienda suspendida muestra mensaje claro y no acepta pedidos.
- [ ] El dueño puede subir comprobante y ver "En verificación" hasta que Super Admin marque como pagado.
- [ ] Reactivación al pagar es < 1 minuto.

---

### 6.16 Módulo: Directorio público de tiendas

Ruta: `/tiendas` (público, sin auth).

#### 6.16.1 Funcionalidades [MVP]

- Lista de todas las tiendas con `status IN (ACTIVE, TRIAL)` y `isPubliclyListed = true`.
- Cards: logo, nombre, vertical, ciudad, descripción corta, link al storefront.
- Filtros:
  - Por vertical (Restaurante, Retail, etc.).
  - Por ciudad (Cochabamba, La Paz, Santa Cruz, etc. — extraído de `Store.city` distinct).
  - Búsqueda por nombre.
- Orden: alfabético / más recientes / destacadas.
- Paginación o infinite scroll (24 por página).
- SEO: cada tienda con su card linkea a `/{slug}` con `rel="noopener"`.

#### 6.16.2 Exclusión

- Las tiendas con `isPubliclyListed = false` (privadas) no aparecen aunque estén activas.
- Las tiendas en `SUSPENDED` o `CANCELLED` nunca aparecen.

#### 6.16.3 Endpoints / Server Actions

```ts
listPublicStoresAction({ filters }): Promise<PublicStore[]>
```

#### 6.16.4 Criterios de aceptación

- [ ] Cargar `/tiendas` muestra todas las tiendas activas en < 2s.
- [ ] Filtrar por vertical actualiza la lista sin reload (cliente).
- [ ] Card linkea correctamente al storefront.
- [ ] Tiendas privadas no aparecen.

---

### 6.17 Módulo: SEO técnico

#### 6.17.1 [MVP]

**Por cada tienda:**
- `<title>` = `metaTitle` o `${store.name} | TuTiendaBo`.
- Meta description = `metaDescription` o primera 150 chars de `description`.
- Open Graph: `og:title`, `og:description`, `og:image` (`ogImageUrl` o `bannerUrl` o `logoUrl`).
- Twitter Card.
- Canonical URL.
- JSON-LD `Store` schema.org en home.
- JSON-LD `Product` schema.org en cada producto (con `offers.priceCurrency: 'BOB'`).

**Sitemap dinámico:**
- `/{slug}/sitemap.xml` con: home, categorías visibles, productos activos.
- `/sitemap.xml` global con: marketing site + directorio de tiendas + index a sitemaps de cada tienda activa.

**Robots.txt:**
- Disallow `/admin`, `/dashboard`, `/api`, `/login`, `/checkout`.
- Allow `/`, `/{slug}/`, `/tiendas/`.
- Sitemap: `https://tutiendabo.com/sitemap.xml`.

**Performance / Core Web Vitals:**
- LCP < 2.5s.
- CLS < 0.1.
- FID/INP < 200ms.
- Imágenes con `next/image`, AVIF/WebP, lazy loading, sizes responsive.
- Critical CSS inline.
- Preload de fuente principal.

#### 6.17.2 [V2]
- Google Analytics 4 + Meta Pixel configurables por dueño (campos en `/dashboard/configuracion/integraciones`).
- Pixel de TikTok Ads.

#### 6.17.3 Criterios de aceptación

- [ ] Lighthouse SEO score >= 95.
- [ ] Lighthouse Performance score >= 80 en mobile.
- [ ] Sitemap accessible y validado.
- [ ] Schema.org Product valida en Google Rich Results Test.

---

### 6.18 Módulo: Importación CSV

#### 6.18.1 Productos

Plantilla CSV descargable con headers en español:

```csv
SKU,Nombre,Categoria,Subcategoria,Precio,PrecioComparacion,Stock,GestionarStock,Descripcion,Activo,EsNuevo,EsBestSeller,EtiquetaCustom,UrlImagen1,UrlImagen2,UrlImagen3,UrlImagen4,UrlImagen5
```

Flujo:
1. Dueño descarga plantilla.
2. Llena en Excel/Sheets.
3. Sube en `/dashboard/productos/importar`.
4. Backend parsea con `papaparse` y valida con Zod.
5. Preview: tabla con productos, productos a crear/actualizar, errores resaltados.
6. Botón "Confirmar importación" ejecuta en batch.
7. Reporte final con conteo y log de errores.

Reglas:
- Si `SKU` existe: actualiza producto. Si no: crea.
- Si `Categoria` no existe: la crea.
- Si `Subcategoria` no existe: la crea bajo `Categoria`.
- `UrlImagen*`: URLs HTTPS — el sistema descarga, procesa con sharp, y guarda local.
- Precio en BOB con punto decimal (`120.50`).
- Booleans como `si`/`no` o `1`/`0`.

#### 6.18.2 Otras importaciones [V2]
- Importar clientes de Excel.
- Importar pedidos históricos para análisis.

---

### 6.19 Módulo: Exportación a Excel

#### 6.19.1 Qué se exporta [MVP]

Desde el panel del dueño (`/dashboard/exportar`):

- **Pedidos**: rango de fechas, todos los campos (incluyendo items en hojas separadas o columnas concatenadas).
- **Productos**: catálogo completo con stock, precios, categorías.
- **Clientes**: lista con stats (#pedidos, total gastado, último pedido).
- **Reporte de ventas**: agregado por día/semana/mes.
- **Cupones**: con uso y revenue generado.

Desde Super Admin (`/admin/exportar`):
- **Tiendas**: todas con plan, estado, MRR atribuido, GMV, fecha de registro.
- **Invoices**: facturación completa.
- **Métricas BI**: snapshots históricos.

#### 6.19.2 Implementación

- Librería: `exceljs`.
- Generación bajo demanda (no precomputado).
- Para exports grandes (>10k filas): job en background (BullMQ) + email con link de descarga.
- Archivos `.xlsx` con:
  - Estilos (headers en negrita, colores).
  - Auto-ancho de columnas.
  - Filtros activados en headers.
  - Pestañas separadas si aplica (ej: "Pedidos" + "Items" + "Resumen").
  - Gráficos embebidos cuando aplique (chartType `column`, `line`).

#### 6.19.3 Endpoints / Server Actions

```ts
exportOrdersAction({ storeId, range, format }): Promise<{ downloadUrl }>
exportProductsAction({ storeId }): Promise<{ downloadUrl }>
exportCustomersAction({ storeId, filters }): Promise<{ downloadUrl }>
exportSalesReportAction({ storeId, range, granularity }): Promise<{ downloadUrl }>
```

#### 6.19.4 Criterios de aceptación

- [ ] Export de 10k pedidos completa en < 30s.
- [ ] Excel se abre en Excel/LibreOffice/Google Sheets sin errores.
- [ ] Headers traducidos al español.
- [ ] Importes con formato de moneda BOB.
- [ ] Fechas en formato `DD/MM/YYYY HH:mm`.

---



## 7. Requerimientos no funcionales

### 7.1 Performance

| Métrica | Objetivo MVP | Objetivo V2 |
|---|---|---|
| LCP (storefront) | < 2,5s en 3G boliviano | < 1,8s |
| CLS | < 0,1 | < 0,05 |
| TTFB | < 600ms | < 400ms |
| Time to Interactive | < 3,5s | < 2,5s |
| API Server Action P95 | < 500ms | < 300ms |
| Búsqueda producto | < 500ms hasta 1k productos | full-text con índice GIN |
| Generación PDF/Excel | < 30s para 10k filas | jobs en BullMQ |
| Export grande | background con email | mismo |

### 7.2 Disponibilidad

- 99,5% mensual (≈3,6h downtime aceptable).
- Maintenance window: domingos 02:00–04:00 BOT, anunciado con 24h.
- Health check endpoint: `/api/health` (DB ping + Redis ping).
- Monitoring externo (UptimeRobot free tier) cada 5 min.

### 7.3 Backups

- **PostgreSQL**: `pg_dump` diario a las 03:00 BOT, retención 30 días.
- **Uploads**: `rsync` diario a almacenamiento secundario (otro VPS o S3-compatible Backblaze).
- **Restore drill**: probar restauración cada 90 días.
- Script: `infra/scripts/backup.sh`.

### 7.4 Escalabilidad

- VPS inicial dimensionado para hasta **500 tiendas activas** y **10k pedidos/mes**.
- Vertical scaling primero (más RAM/CPU).
- Cuando se llega al 70% de capacidad: planificar migración a Postgres dedicado + app servers separados.
- Caché de tenant resolution en Redis (TTL 5 min) reduce queries a Postgres.
- ISR para storefront público (revalidate 60s para producto, 300s para home).

### 7.5 Mantenibilidad

- Code coverage objetivo: > 60% en lógica de negocio (server actions y services).
- Tests e2e críticos: registro tienda, crear producto, hacer pedido, verificar comprobante, generar factura.
- Documentación inline (TSDoc) en funciones públicas de `server/services/`.
- Migrations versionadas con Prisma Migrate.

### 7.6 Internacionalización

- MVP: solo español Bolivia (`es-BO`).
- Estructura de strings centralizada en `lib/i18n/es-BO.ts` para futura migración.
- Formato fechas: `DD/MM/YYYY`. Moneda: `Bs ${amount.toFixed(2)}`.

---

## 8. Seguridad

### 8.1 Autenticación

- Bcrypt cost 12 para passwords.
- JWT firmado con `NEXTAUTH_SECRET` (256-bit).
- Sesiones de 30 días con sliding refresh.
- Rate limiting login: 5 intentos / IP / minuto (Redis).
- Recovery tokens: 1 uso, expira 1h.

### 8.2 Autorización

- Cada Server Action y Route Handler **debe** llamar guard correspondiente (`requireSuperAdmin`, `requireStoreAccess`, etc.) en la primera línea.
- ESLint rule custom: detectar Server Actions sin guard (post-MVP).
- No confiar en client-side checks: siempre validar en server.

### 8.3 Validación de entrada

- Todo input externo pasa por **Zod schema**.
- Sanitización HTML (descripciones de producto): `DOMPurify` server-side.
- Uploads validados por: extensión, MIME real (con `file-type`), tamaño, dimensiones max.
- SQL injection: prevenido por Prisma (queries parametrizadas).
- XSS: React escapa por default; `dangerouslySetInnerHTML` solo con HTML sanitizado.
- CSRF: Server Actions de Next.js incluyen token automático.

### 8.4 Secrets

- `.env` nunca commiteado.
- Secrets en GitHub Actions vía Encrypted Secrets.
- En VPS: archivo `.env.production` con permisos `600`, propietario root.
- Rotación de `NEXTAUTH_SECRET` cada 6 meses (planificado).

### 8.5 Headers HTTP

Configurar en `next.config.ts` y Nginx:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: geolocation=(self), microphone=(), camera=()
```

### 8.6 Rate limiting

| Endpoint | Límite |
|---|---|
| Login | 5/min/IP |
| Registro | 3/hora/IP |
| Reset password | 3/hora/email |
| Crear pedido | 10/min/IP |
| Subir comprobante | 5/min/usuario |
| Search storefront | 30/min/IP |
| Cualquier otro write | 60/min/usuario |

Implementación: middleware Redis con sliding window.

### 8.7 Datos personales

- Habeas Data Bolivia: anteproyecto en discusión, pero adoptamos buenas prácticas:
  - Cliente puede solicitar export de sus datos (email a soporte en MVP, automatizado V2).
  - Cliente puede solicitar eliminación.
  - Password nunca aparece en logs.
  - PII no se envía a Sentry (filter en SDK).
- Encriptación TLS 1.3 en tránsito.
- Encriptación at-rest: el VPS debe tener disco encriptado (LUKS si se ofrece).

### 8.8 Auditoría

`AuditLog` registra:
- Suspensiones / eliminaciones de tiendas.
- Impersonations.
- Cambios de plan.
- Cambios de password.
- Logins fallidos repetidos.
- Verificaciones de comprobantes (decisión + razón).

---

## 9. Despliegue en VPS

### 9.1 Prerequisitos del VPS

- Ubuntu 22.04 LTS o Debian 12.
- Mínimo: 4 vCPU, 8 GB RAM, 80 GB SSD (escalable).
- Recomendado MVP: 4 vCPU, 8 GB RAM, 160 GB SSD.
- Acceso SSH con clave (root deshabilitado, usuario `deploy` con sudo).
- Firewall UFW: solo abre 22 (SSH), 80, 443.
- Fail2ban configurado.
- Domain DNS apuntando A → IP del VPS.

### 9.2 Stack runtime en VPS

```
docker-compose.prod.yml:
  - app (Next.js 15) — port 3000
  - postgres:16 — port 5432 (interna)
  - redis:7-alpine — port 6379 (interna)
  - nginx — port 80, 443 (host)
  - certbot — para renovación SSL
```

### 9.3 `docker-compose.prod.yml` (esqueleto)

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/var/www/uploads
    ports:
      - "127.0.0.1:3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/tutiendabo.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./uploads:/var/www/uploads:ro
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres_data:
  redis_data:
```

### 9.4 Nginx config (`infra/nginx/tutiendabo.conf`)

```nginx
upstream app_upstream {
  server app:3000;
}

# Redirección HTTP → HTTPS
server {
  listen 80;
  server_name tutiendabo.com www.tutiendabo.com;
  
  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }
  
  location / {
    return 301 https://$host$request_uri;
  }
}

# HTTPS
server {
  listen 443 ssl http2;
  server_name tutiendabo.com www.tutiendabo.com;

  ssl_certificate /etc/letsencrypt/live/tutiendabo.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tutiendabo.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  client_max_body_size 10M;
  
  # Headers de seguridad
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  
  # Static uploads servidos directo
  location /uploads/ {
    alias /var/www/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
  }
  
  # Next.js _next/static
  location /_next/static/ {
    proxy_pass http://app_upstream;
    proxy_cache_valid 200 1y;
    add_header Cache-Control "public, immutable";
  }
  
  # Resto: proxy a Next.js
  location / {
    proxy_pass http://app_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 60s;
  }
  
  # SSE endpoints (long-lived)
  location ~ ^/api/.*/stream$ {
    proxy_pass http://app_upstream;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 24h;
    chunked_transfer_encoding on;
  }
}
```

### 9.5 Dockerfile

```dockerfile
# Multi-stage build
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

`next.config.ts` debe tener `output: 'standalone'`.

### 9.6 Cron jobs en host

```bash
# /etc/cron.d/tutiendabo
0 3 * * *  deploy  /opt/tutiendabo/infra/scripts/backup.sh >> /var/log/tutiendabo-backup.log 2>&1
*/15 * * * * deploy curl -fsS http://localhost:3000/api/cron/cleanup-carts > /dev/null
0 1 * * *  deploy curl -fsS http://localhost:3000/api/cron/generate-invoices > /dev/null
30 1 * * * deploy curl -fsS http://localhost:3000/api/cron/send-billing-reminders > /dev/null
0 2 * * *  deploy curl -fsS http://localhost:3000/api/cron/suspend-overdue > /dev/null
```

Cada endpoint `/api/cron/*` valida un header `X-Cron-Secret` para no ser ejecutable desde fuera.

### 9.7 CI/CD (GitHub Actions)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run build
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/tutiendabo
            git pull origin main
            docker compose -f docker-compose.prod.yml build app
            docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
            docker compose -f docker-compose.prod.yml up -d app
            docker compose -f docker-compose.prod.yml exec -T app curl -f http://localhost:3000/api/health
```

### 9.8 Backup script (`infra/scripts/backup.sh`)

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR=/opt/tutiendabo/backups
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# DB backup
docker compose -f /opt/tutiendabo/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Uploads backup
tar czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /opt/tutiendabo uploads/

# Limpiar antiguos
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Sync remoto opcional (rsync a otro server)
# rsync -av --delete "$BACKUP_DIR/" backup@otroserver:/backups/tutiendabo/

echo "Backup completado: $DATE"
```

---

## 10. Plan de sprints (6 meses para MVP completo)

### Sprint 0 — Setup (semana 1)

- [ ] Crear repo GitHub privado.
- [ ] Configurar Next.js 15 + TypeScript estricto + Tailwind + shadcn/ui.
- [ ] Configurar Prisma + Postgres local con Docker.
- [ ] Configurar ESLint/Biome + Prettier + Husky + lint-staged.
- [ ] Estructura de carpetas según §3.3.
- [ ] Provisión VPS + Docker + DNS + SSL Let's Encrypt.
- [ ] CI básico (lint + test + build) en GitHub Actions.
- [ ] Variables de entorno separadas por environment.

**Entregable**: "Hello World" deployando automáticamente a `tutiendabo.com`.

### Sprint 1 — Auth y Tienda básica (semanas 2–3)

- [ ] Schema Prisma completo (sección §4).
- [ ] Auth.js v5 con credentials provider.
- [ ] Páginas: `/login`, `/recovery`, `/recovery/{token}`.
- [ ] Server Actions: login, logout, registerCustomer, requestPasswordReset, resetPassword.
- [ ] Middleware con resolución de tenant path-based (§3.2).
- [ ] Seed inicial (Super Admin, Plans, Templates).
- [ ] Super Admin: CRUD de tiendas (`/admin/tiendas`).
- [ ] Email SMTP funcionando (welcome, recovery).

**Entregable**: Super Admin puede crear tienda; Store Owner puede loguear (storefront aún no existe).

### Sprint 2 — Catálogo (semanas 4–5)

- [ ] Module Productos completo: CRUD + variantes + categorías + stock + horarios + imágenes.
- [ ] Upload de imágenes con sharp + storage local.
- [ ] Módulo Promociones: cupones, banners, popups.
- [ ] Storefront público básico: home, categoría, producto, búsqueda.
- [ ] Plantilla `retail_v1` funcional.
- [ ] Importación CSV de productos.

**Entregable**: una tienda puede tener catálogo público navegable.

### Sprint 3 — Carrito y Checkout (semanas 6–7)

- [ ] Carrito persistente (guest token + customer linking).
- [ ] Drawer del carrito + página `/{slug}/carrito`.
- [ ] Checkout 1-page con Leaflet + zonas de delivery.
- [ ] Cálculo de envío por zona / "se confirma por WhatsApp".
- [ ] Aplicación de cupones.
- [ ] Crear pedido + generación link wa.me.
- [ ] Página de "Pedido confirmado" con CTA WhatsApp.
- [ ] Tracking público `/{slug}/orden/{token}`.
- [ ] Subida de comprobante de pago QR.

**Entregable**: cliente puede comprar end-to-end y avisar por WhatsApp.

### Sprint 4 — Dashboard del Owner (semanas 8–9)

- [ ] Layout dashboard + sidebar.
- [ ] Lista y detalle de pedidos.
- [ ] Cambio de estado FSM con eventos.
- [ ] Verificación de comprobante.
- [ ] SSE para notificación tiempo real de nuevos pedidos.
- [ ] Edición de pedido (agregar/quitar items).
- [ ] Configuración: branding, colores, fuente, contactos, redes, horarios, métodos de pago, QR.
- [ ] Selector de plantilla.
- [ ] Gestión de cajeros (staff).
- [ ] Dark mode con detección automática.

**Entregable**: el dueño opera su tienda completa desde el dashboard.

### Sprint 5 — 5 Plantillas y Polish UI (semanas 10–11)

- [ ] Plantilla `restaurant_v1`.
- [ ] Plantilla `food_truck_v1`.
- [ ] Plantilla `hardware_v1`.
- [ ] Plantilla `services_v1`.
- [ ] Polish visual de las 5 plantillas (responsive perfecto).
- [ ] Directorio público `/tiendas`.
- [ ] SEO: sitemaps por tienda, schema.org, meta tags.

**Entregable**: 5 plantillas pulidas + directorio + SEO técnico completo.

### Sprint 6 — Analytics y BI (semanas 12–13)

- [ ] Dashboard del owner: tabs Resumen, Productos, Clientes, Heatmap, Embudo, Promociones.
- [ ] Heatmap geográfico con leaflet.heat.
- [ ] Dashboard Super Admin: salud SaaS, crecimiento, GMV, heatmap global, operaciones.
- [ ] Pre-agregaciones nocturnas (cron) en `MetricSnapshot`.
- [ ] Exportación a Excel: pedidos, productos, clientes, reporte de ventas.

**Entregable**: BI completo con heatmap.

### Sprint 7 — Billing del SaaS (semanas 14–15)

- [ ] Modelo de Plans + Invoice.
- [ ] Trial de 30 días.
- [ ] Generación automática de invoices (cron).
- [ ] Recordatorios de pago (email).
- [ ] Subida de comprobante por dueño.
- [ ] Verificación por Super Admin.
- [ ] Suspensión automática por impago + cron.
- [ ] Reactivación.
- [ ] Cambio de plan con prorrateo.
- [ ] Página de billing en dashboard owner.
- [ ] Página de cobranza en super admin.

**Entregable**: ciclo completo de facturación automatizado.

### Sprint 8 — Hardening y Lanzamiento (semanas 16–17)

- [ ] Tests e2e Playwright para flujos críticos.
- [ ] Auditoría de seguridad (rate limiting completo, headers CSP, validación inputs).
- [ ] Backups automáticos probados (restore drill).
- [ ] Sentry configurado y errores trackeados.
- [ ] Marketing site mínimo en `/` (landing).
- [ ] Documentación de onboarding para nuevas tiendas.
- [ ] Migración de las primeras 5 tiendas piloto.
- [ ] Lanzamiento público.

**Entregable**: producto en producción con primeras tiendas pagando.

### Post-MVP — Sprints 9 a 12 (meses 5–6)

| Sprint | Foco |
|---|---|
| Sprint 9 | QR dinámico (BNB API o Pay-me) — diferenciador plan Business |
| Sprint 10 | Chatbot IA con OpenAI + RAG sobre catálogo |
| Sprint 11 | WhatsApp Business API para confirmaciones automáticas al cliente |
| Sprint 12 | Facturación SIN (factura electrónica integrada) |

### Backlog V3+

- Multi-sucursal (una tienda con varios locales).
- Programa de fidelidad / puntos.
- Email marketing integrado.
- App móvil (React Native o PWA avanzada).
- Marketplace mode (cliente compra de varias tiendas en un mismo carrito).
- Dominio propio del cliente (`mibig-bite.com`).
- Integración con servicios de delivery (PedidosYa, Yango).
- Comisión por transacción (si se decide cambiar modelo a take-rate).

---

## 11. Decisiones pendientes / Open Questions

Estos puntos no están totalmente resueltos. Claude Code debe preguntar al usuario si los necesita:

1. **Nombre del dominio principal**. Placeholder usado: `tutiendabo.com`. Decidir y comprar antes de Sprint 0.

2. **Productos digitales**: ¿en MVP, V2 o nunca? El usuario no respondió explícitamente. Si se decide incluirlos, definir flujo de entrega (descarga, código por email, etc.) y campos extra en `Product`.

3. **Esquema exacto de planes/precios**. La tabla en §6.15.1 es placeholder. Requiere validación de mercado: ¿USD 99/mes Pro es competitivo? Quick cobra USD 220/año (~Bs 130/mes equivalente). Revisar antes de exponer al público.

4. **Dominio / pasarela para cobrar a los merchants**. En MVP es transferencia/QR manual al Super Admin. Post-MVP definir si Pay-me Cybersource (recurrente con tarjeta) o seguir con manual.

5. **Detalles del Chatbot IA (V2)**: alcance exacto, costo aceptable por mensaje, idioma del prompt, manejo de preguntas fuera de scope.

6. **Política de moderación**: ¿qué pasa si una tienda viola T&C (vende productos prohibidos, contenido ofensivo)? Definir proceso.

7. **Proceso de soporte**: canal (WhatsApp dedicado, email), SLA, escalamiento.

8. **Estrategia de migración de tiendas existentes** (clientes que vienen de Quick u otros). ¿Importación de catálogo? ¿Asistencia manual?

9. **Términos y condiciones reales** del SaaS y política de privacidad. Requiere asesoría legal local.

10. **Branding del SaaS**: nombre, logo, paleta. Independiente de "tutiendabo.com".

11. **Personalización de templates**: ¿qué tan profundo puede customizar el dueño en MVP? Asumido: solo colores/logo/fuente/textos. Confirmar.

12. **Idioma de los emails transaccionales**: español neutro vs español Bolivia.

13. **Geocodificación inversa**: ¿usar Nominatim (gratis) o Google Geocoding API (paga, mejor calidad) en Bolivia?

14. **Watermark del plan Starter**: diseño y posicionamiento exacto.

---

## 12. Glosario expandido

| Término | Definición |
|---|---|
| **Tenant** | Cada tienda virtual de un cliente del SaaS. Se identifica por `slug` único |
| **Slug** | Identificador URL único de cada tienda. Ej: `big-bite-wings` |
| **MRR** | Monthly Recurring Revenue — ingresos recurrentes mensuales del SaaS |
| **ARR** | Annual Recurring Revenue — equivalente anualizado de MRR |
| **GMV** | Gross Merchandise Value — total transaccionado a través de la plataforma (NO es ingreso del SaaS, es el volumen total de las tiendas) |
| **Churn** | Tiendas que cancelan su suscripción |
| **LTV** | Customer Lifetime Value — ingreso esperado de un cliente durante toda su vida |
| **CAC** | Customer Acquisition Cost — costo de adquirir un nuevo cliente |
| **LCP** | Largest Contentful Paint — métrica Core Web Vital |
| **SSE** | Server-Sent Events — protocolo unidireccional servidor→cliente para tiempo real |
| **RBAC** | Role-Based Access Control |
| **FSM** | Finite State Machine — máquina de estados (usada para `OrderStatus`) |
| **RAG** | Retrieval-Augmented Generation — técnica para chatbots con contexto |
| **ISR** | Incremental Static Regeneration de Next.js |
| **SIN** | Servicio de Impuestos Nacionales (Bolivia) |
| **BOB** | Boliviano (código ISO 4217 de la moneda) |

---

## 13. Notas finales para Claude Code

### 13.1 Orden recomendado de implementación

Seguir estrictamente el plan de sprints (§10). En particular:

1. **No empezar por la UI bonita**. Schema → Auth → Server Actions → UI mínima funcional → Polish.
2. **Tests desde Sprint 1**. No "los agregaremos después".
3. **Cada Server Action con guard** desde el primer momento (§5.3 y §8.2).
4. **Multi-tenancy correctamente aislado** en `lib/tenant/`. Si en V3 se cambia a subdominios, no debe haber refactor masivo.

### 13.2 Convenciones de código

- TypeScript estricto. `any` prohibido excepto en wrapping de librerías sin tipos.
- Server Actions: archivo por dominio (`product.actions.ts`), una función exportada por acción.
- Naming:
  - Server Actions: `xxxAction` (ej: `createProductAction`).
  - Services: `xxxService` o `xxx-service.ts`.
  - Componentes UI: PascalCase.
  - Hooks: `useXxx`.
- Comentarios en español o inglés (consistente). Recomendación: código en inglés, mensajes al usuario final en español.
- Errores: clase custom `AppError` extendiendo `Error` con `code`, `httpStatus`, `userMessage`.

### 13.3 Qué evitar

- ❌ No usar `useEffect` para fetching cuando hay Server Components.
- ❌ No exponer IDs internos del DB en URLs públicas — usar `slug` o `trackingToken`.
- ❌ No confiar en datos del client (cantidades, precios) — siempre recalcular en server.
- ❌ No hacer `JOIN` masivos sin paginación.
- ❌ No copiar contraseñas a logs.
- ❌ No bloquear el thread de Node con operaciones síncronas pesadas (usar workers o background jobs).

### 13.4 Setup local rápido

```bash
git clone <repo>
cd tutiendabo
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
# → http://localhost:3000
# Super Admin: el del seed
```

### 13.5 Recursos

- Diseño de competidor: ver reporte de research previo (Quick One — myquickone.com).
- Mercado Bolivia: e-commerce CAGR 10,6% (Statista). QR interoperable BCB +4733% 2021–2024.
- Pasarelas locales para V2: BNB QR Commerce API, Pay-me Cybersource, Libélula.

---

**Fin del SRS — Versión 1.0**

*Cualquier ambigüedad en este documento debe ser preguntada antes de implementar, no asumida.*
