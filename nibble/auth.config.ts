import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/auth/impersonation-shared";

/**
 * Config "Edge-safe" de NextAuth: solo callbacks que NO tocan Prisma ni
 * APIs de Node. Se importa desde `middleware.ts` para que el bundle del
 * middleware (que corre en V8 isolates / Edge Runtime) no arrastre
 * `@prisma/client` — ese fallaría en runtime con "binary engines not
 * supported on edge".
 *
 * `auth.ts` extiende esta config agregando el provider `Credentials` +
 * el callback `jwt` que sí pega a Prisma. Esa versión completa se usa
 * en RSC, server actions y route handlers — siempre Node runtime.
 *
 * Pattern oficial: https://authjs.dev/guides/edge-compatibility
 *
 * # Limitación intencional: ventana de revalidación en Edge
 *
 * El callback `jwt` (que invalida sesiones por `isActive: false` o
 * `passwordChangedAt` rancia) vive sólo en `auth.ts` porque pega a Prisma.
 * Como consecuencia, el middleware Edge ve el JWT con sus claims tal cual
 * fueron escritos en el último jwt-callback de Node — sin re-validar.
 *
 * Worst case: un usuario suspendido/reseteado puede navegar páginas RSC
 * cacheadas hasta que la próxima ejecución en Node (cualquier server action,
 * cualquier guard `requireX` en una page) re-valide el token y lo invalide.
 * Las MUTACIONES (server actions) siempre corren en Node → siempre revalidan.
 *
 * Si necesitas revocación instantánea para un caso concreto:
 *   - cambiar la `passwordHash` del usuario en DB (rompe el JWT en el próximo
 *     `verifyPassword` del recovery flow), o
 *   - migrar a sesiones DB-backed (cuesta una query Prisma por request).
 */
export default {
  pages: {
    signIn: "/login",
  },
  // NO declaramos `providers` acá: el middleware solo necesita
  // `authorized` (chequeo de cookies + path). El provider Credentials,
  // que invoca Prisma en `authorize`, vive en `auth.ts` (Node).
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.sub ?? session.user.id) as string;
        session.user.role = token.role as Role;
        session.user.storeId = (token.storeId ?? null) as string | null;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isAuthed = !!session?.user;
      const role = session?.user?.role;

      if (pathname.startsWith("/admin")) {
        return isAuthed && role === "SUPER_ADMIN";
      }
      if (pathname.startsWith("/dashboard")) {
        // SUPER_ADMIN normalmente NO entra al dashboard de tiendas — su
        // panel es /admin. Excepción: cuando hay cookie de impersonation,
        // significa que el admin está configurando una tienda como shadow
        // owner. En ese caso lo dejamos pasar al /dashboard; el guard del
        // server (`requireStoreOwner`) revalida que la cookie apunte a
        // una tienda real.
        if (role === "STORE_OWNER" || role === "CASHIER") return isAuthed;
        if (
          role === "SUPER_ADMIN" &&
          isAuthed &&
          request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value
        ) {
          return true;
        }
        return false;
      }
      // Resto: público
      return true;
    },
  },
} satisfies NextAuthConfig;
