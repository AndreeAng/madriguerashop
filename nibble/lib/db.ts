import "server-only";
import { PrismaClient } from "@prisma/client";

// Singleton — evita "too many connections" en dev por HMR.
// `import "server-only"` arriba: si un Client Component lo importa por
// accidente, Next falla en build con error claro en vez de bundlear
// Prisma (varios MB) al cliente y leak credenciales en runtime.
//
// Usamos `globalThis` (no `global`): el módulo se evalúa también en Edge
// runtime cuando middleware importa `auth.ts → db.ts`. Edge no define
// `global`, sólo `globalThis`. En la práctica Prisma no se INVOCA desde
// Edge (auth.ts está pensado para correr en Node), pero la evaluación del
// módulo sí ocurre, y `global.__prisma` tira ReferenceError antes de llegar
// a cualquier consumer.
declare global {
  var __prisma: PrismaClient | undefined;
}

export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = db;
}
