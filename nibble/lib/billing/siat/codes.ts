import "server-only";
// import { db } from "@/lib/db";
import { siatConfig } from "./config";
import { SiatClient } from "./client";
import type { SiatCredentials } from "./types";

// TODO(SIAT): este módulo asume `model SiatCode` en `prisma/schema.prisma`,
// que todavía no existe. Antes de usar `getOrRefreshCUIS/CUFD` en runtime,
// agregar el modelo (ver `.claude/skills/siat-bolivia/SKILL.md` sección 6) y
// descomentar el import + las llamadas a `db.siatCode.*` de abajo.

/**
 * Manejo de CUIS y CUFD con cache en DB.
 *
 * Patrón:
 *   1. Buscar en DB un código vigente para (storeId, type).
 *   2. Si existe y no expiró → retornarlo.
 *   3. Si no → llamar al SIN, persistir, retornar.
 */

export async function getOrRefreshCUIS(
  creds: SiatCredentials,
): Promise<string> {
  // TODO: cuando esté el modelo SiatCode en Prisma:
  //
  // const cached = await db.siatCode.findFirst({
  //   where: {
  //     storeId: creds.storeId,
  //     type: "CUIS",
  //     expiresAt: { gt: new Date() },
  //   },
  // });
  // if (cached) return cached.code;

  const client = new SiatClient(creds);
  const { cuis, expiresAt } = await client.iniciarSistema();

  // await db.siatCode.create({
  //   data: { storeId: creds.storeId, type: "CUIS", code: cuis, expiresAt },
  // });

  void siatConfig;
  void expiresAt;
  return cuis;
}

export async function getOrRefreshCUFD(
  creds: SiatCredentials,
  cuis: string,
): Promise<string> {
  // TODO: similar al CUIS, cachear por 24h en DB.

  const client = new SiatClient(creds);
  const { cufd } = await client.obtenerCufd(cuis);
  return cufd;
}

/**
 * Invalidar el CUFD cacheado — útil cuando el SIN devuelve código 904
 * (CUFD inválido o expirado) y queremos forzar refresh.
 */
export async function invalidateCUFD(_storeId: string): Promise<void> {
  // await db.siatCode.deleteMany({
  //   where: { storeId, type: "CUFD" },
  // });
}
