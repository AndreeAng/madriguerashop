import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
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
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    storeId: string | null;
  }
}

const credentialsSchema = z.object({
  username: z.string().min(1, "Email o teléfono requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
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
          },
        });

        if (!user || !user.isActive) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Actualiza lastLoginAt asíncrono — no bloqueante
        db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          storeId: user.storeId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.storeId = user.storeId;
      }
      return token;
    },
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

      // Rutas protegidas
      if (pathname.startsWith("/admin")) {
        return isAuthed && role === "SUPER_ADMIN";
      }
      if (pathname.startsWith("/dashboard")) {
        return isAuthed && (role === "STORE_OWNER" || role === "CASHIER" || role === "SUPER_ADMIN");
      }
      // Resto: público
      return true;
    },
  },
});
