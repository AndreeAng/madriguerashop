# madriguerashop

Plataforma SaaS de tienda virtual multi-tenant. Construida con **Next.js 15**, **Prisma**, **NextAuth v5** y **Tailwind CSS 4**.

## Estructura del repositorio

```
.
├── nibble/                 # Aplicación Next.js (código de producción)
│   ├── app/                # App Router (rutas, layouts, server actions)
│   ├── components/         # Componentes React reutilizables
│   ├── lib/                # Utilidades, clientes (db, auth, etc.)
│   ├── prisma/             # Schema y migraciones de Prisma
│   ├── server/             # Lógica server-side
│   └── tests/              # Tests
├── docs/                   # Documentación de producto y diseño
│   ├── SRS-saas-tienda-virtual.md
│   └── design/             # Screenshots y referencias visuales
└── README.md
```

## Desarrollo local

```bash
cd nibble
cp .env.example .env        # Configura tus variables
npm install
npm run db:generate
npm run db:push
npm run db:seed             # Opcional: datos de prueba
npm run dev
```

App en `http://localhost:3000`.

## Variables de entorno

Ver `nibble/.env.example` para la lista completa. Claves críticas:

- `DATABASE_URL` — connection string de PostgreSQL
- `NEXTAUTH_SECRET` — generar con `openssl rand -base64 32`
- `NEXTAUTH_URL` — URL pública de la app
- `SMTP_*` — credenciales para envío de correos

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | Linter |
| `npm run db:migrate` | Aplica migraciones de Prisma |
| `npm run db:studio` | UI de Prisma Studio |
| `npm run db:seed` | Pobla la BD con datos de prueba |
