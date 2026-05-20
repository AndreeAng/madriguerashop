import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check para uptime monitors / load balancers.
 *
 * Público y sin auth: solo expone status + latencia. NO devuelve metadata
 * de infra (versión de Node, presencia de env vars, etc.) — esa información
 * es reconocimiento gratis para un atacante.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DB_TIMEOUT_MS = 2000;

async function checkDb(): Promise<{ ok: boolean; latencyMs?: number }> {
  const started = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), DB_TIMEOUT_MS),
      ),
    ]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const dbCheck = await checkDb();
  const allOk = dbCheck.ok;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        // Sin no-store, CDNs/proxies pueden cachear el último 200 "ok" y
        // los monitores de uptime no detectan caídas reales. `revalidate=0`
        // afecta solo al data cache de Next, no al HTTP cache de la capa
        // de edge.
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
