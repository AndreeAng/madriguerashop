import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
// IMPORTANTE: usamos `auth.config.ts` (Edge-safe) y NO `auth.ts` completo.
// El módulo `auth.ts` arrastra Prisma vía el callback `jwt`, y Prisma no
// corre en Edge Runtime (binary engines). Si el middleware importa
// `auth.ts`, cada request del middleware revienta con "PrismaClient is
// unable to run in this browser environment".
//
// Web Crypto (`globalThis.crypto`) está disponible en Edge Runtime y trae
// `randomUUID()` desde V8 19+. Importar `node:crypto` rompe el bundle de
// middleware porque Edge no expone APIs de Node.
const { auth } = NextAuth(authConfig);

const VISITOR_COOKIE = "mv_visitor";
const SESSION_COOKIE = "mv_session";
const VISITOR_TTL_S = 60 * 60 * 24 * 180; // 6 meses
const SESSION_TTL_S = 60 * 30; // 30 min sliding

export default auth((req) => {
  // El callback `authorized` en auth.ts ya maneja la redirección.
  // Si no autorizado en /admin o /dashboard, NextAuth redirige a /login automáticamente.

  // Bootstrap de cookies de analytics. Antes esto vivía en `trackPageView`
  // (Server Component) y fallaba silenciosamente — Next.js 15 no permite
  // `cookies().set()` en RSC. Acá en middleware sí podemos escribir.
  const res = NextResponse.next();
  const cookies = req.cookies;

  if (!cookies.get(VISITOR_COOKIE)?.value) {
    res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      maxAge: VISITOR_TTL_S,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  // Sesión sliding: renovar cada hit para que 30 min sea "tiempo de
  // inactividad", no "tiempo desde primer pageview".
  const sessionToken = cookies.get(SESSION_COOKIE)?.value ?? crypto.randomUUID();
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    maxAge: SESSION_TTL_S,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
});

export const config = {
  // Aplica a todo EXCEPTO archivos estáticos, _next, api/auth (que se maneja
  // solo), api/health (no necesita sesión y debe responder rápido al monitor)
  // y api/cron (autentica con bearer propio).
  matcher: [
    "/((?!api/auth|api/health|api/cron|_next/static|_next/image|favicon.ico|icon.svg|uploads|.*\\..*).*)",
  ],
};
