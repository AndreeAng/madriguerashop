import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import authConfig from "./auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeIdentifier } from "@/lib/auth/identifiers";
import type { Role } from "@prisma/client";

// Augmentamos el tipo de session/user para incluir role + storeId
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      storeId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    storeId: string | null;
    pwChangedAt?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    storeId: string | null;
    // Timestamp ms de la última validación contra DB. Permite revocar
    // sesiones de usuarios suspendidos sin guardar nada en memoria.
    validatedAt?: number;
    // Snapshot ms del `User.passwordChangedAt` al momento del sign-in.
    // Si la DB tiene un valor más nuevo, el JWT está rancio (la password
    // se reseteó después del login) y hay que invalidar la sesión.
    pwChangedAt?: number;
  }
}

// Ventana de re-validación del JWT contra la DB. Cada request que llegue
// con un token "viejo" (>JWT_REVALIDATE_MS desde la última verificación)
// dispara un findUnique para chequear isActive/role/storeId.
// Worst case: un usuario suspendido sigue accediendo hasta JWT_REVALIDATE_MS.
//
// 60s es el balance elegido entre revocación rápida y carga de DB: para un
// owner suspendido por morosidad o compromiso de cuenta, la ventana ciega
// es de hasta 1 minuto — corto suficiente para que no opere significativo
// y largo suficiente para que un cliente activo no pague una query Prisma
// por cada navegación. Las mutaciones (server actions) siempre revalidan
// si el token quedó viejo durante la sesión, así que el riesgo real está
// solo en lecturas RSC, donde 60s de exposición es aceptable.
const JWT_REVALIDATE_MS = 60_000;

const credentialsSchema = z.object({
  username: z.string().min(1, "Email o teléfono requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

// NextAuth v5 lee AUTH_SECRET por defecto, pero la beta acepta NEXTAUTH_SECRET
// de forma inconsistente. Lo pasamos explícitamente con fallback para que el
// rename de la variable sea seguro y no dependa del comportamiento del beta.
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "AUTH_SECRET (o NEXTAUTH_SECRET) es obligatorio en producción. " +
      "Generá uno con: openssl rand -base64 32",
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Heredamos pages, session callback y authorized callback del config
  // Edge-safe. Sobre eso agregamos: secret, providers (Credentials) y el
  // callback `jwt` (que pega a Prisma → Node-only).
  ...authConfig,
  secret: authSecret,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Email o teléfono", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const { kind, value } = normalizeIdentifier(username);
        if (kind === "unknown") return null;

        const user = await db.user.findUnique({
          where: { username: value },
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            passwordHash: true,
            role: true,
            storeId: true,
            isActive: true,
            fullName: true,
            passwordChangedAt: true,
          },
        });

        if (!user || !user.isActive) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Actualiza lastLoginAt asíncrono — no bloqueante. Si falla, queda
        // log para que ops vea fallas reiteradas de DB (no rompe el login).
        db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch((err) => console.error("[auth] lastLoginAt update failed", err));

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          storeId: user.storeId,
          // Snapshot del momento de issuance: el callback `jwt` compara
          // este valor contra DB.passwordChangedAt para invalidar JWTs
          // emitidos antes de un reset/cambio de password.
          pwChangedAt: user.passwordChangedAt?.getTime() ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    // Mergeamos los callbacks del config Edge-safe (session, authorized)
    // con los Node-only que viven sólo acá (jwt, que toca Prisma).
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Login inicial: el authorize callback nos pasa user y confiamos.
      if (user) {
        token.role = user.role;
        token.storeId = user.storeId;
        token.validatedAt = Date.now();
        token.pwChangedAt = user.pwChangedAt ?? 0;
        return token;
      }

      // Request subsiguiente: revalidar contra DB si pasó la ventana.
      const lastValidated = token.validatedAt ?? 0;
      if (Date.now() - lastValidated < JWT_REVALIDATE_MS) {
        return token;
      }

      const userId = token.sub;
      if (!userId) return null;

      // try-catch defensivo: un error transitorio de DB (conexión cerrada,
      // reinicio del container) NO debe invalidar la sesión del usuario.
      // Sólo invalidamos si la query confirma que el user no existe o está
      // inactivo. Antes un blip de DB ejecutaba `return null` y el usuario
      // perdía la sesión sin explicación.
      let fresh:
        | {
            isActive: boolean;
            role: Role;
            storeId: string | null;
            passwordChangedAt: Date | null;
          }
        | null;
      try {
        fresh = await db.user.findUnique({
          where: { id: userId },
          select: {
            isActive: true,
            role: true,
            storeId: true,
            passwordChangedAt: true,
          },
        });
      } catch (err) {
        console.error("[auth] revalidate failed, keeping existing token", err);
        // Devolver el token sin actualizar `validatedAt` → reintentará
        // en el próximo request. No hace doom-loop si DB sigue caída.
        return token;
      }

      // Usuario borrado o suspendido → invalida la sesión.
      if (!fresh || !fresh.isActive) return null;

      // Password cambiada después de emitir el JWT → invalidar. Esto
      // cierra la ventana donde un link de recovery interceptado dejaba
      // co-existir la sesión legítima y la del atacante hasta el próximo
      // login. Cualquier reset, password change manual o admin force-reset
      // hace que la sesión activa expire en el próximo revalidate.
      const dbPwChangedAt = fresh.passwordChangedAt?.getTime() ?? 0;
      const tokenPwChangedAt = token.pwChangedAt ?? 0;
      if (dbPwChangedAt > tokenPwChangedAt) return null;

      token.role = fresh.role;
      token.storeId = fresh.storeId;
      token.validatedAt = Date.now();
      return token;
    },
  },
});
