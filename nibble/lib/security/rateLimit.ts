import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter con dos backends:
 *
 *  - **Upstash Redis** (producción): si `UPSTASH_REDIS_REST_URL` y
 *    `UPSTASH_REDIS_REST_TOKEN` están seteados, usamos `@upstash/ratelimit`
 *    con sliding window. Persiste entre cold starts y comparte estado entre
 *    instancias serverless / cluster workers.
 *
 *  - **In-memory fallback** (dev / VPS single-worker): Map local con sliding
 *    window manual. Cumple para development y para VPS con un solo worker.
 *    NO usar en serverless con cold starts ni en cluster — el atacante
 *    bypassea esperando a que el proceso se reinicie o multiplica por N
 *    workers.
 *
 * Diseño:
 *   - Cada caller pide un `limit` y `windowMs` arbitrario. Upstash crea un
 *     `Ratelimit` instance distinto por combinación (cacheado en `cache`)
 *     para evitar overhead.
 *   - El shape del resultado es estable entre backends para que los callers
 *     existentes no cambien.
 */

type Entry = { count: number; resetAt: number };
const memoryStore = new Map<string, Entry>();

let consumeCounter = 0;
const SWEEP_EVERY = 256;

function sweepMemory(now: number) {
  for (const [key, e] of memoryStore) {
    if (e.resetAt <= now) memoryStore.delete(key);
  }
}

// ============== Upstash setup (perezoso) ==============

let redisClient: Redis | null = null;
const upstashCache = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  const cached = upstashCache.get(key);
  if (cached) return cached;
  // Sliding window — más justo que fixed window porque distribuye el cap
  // sobre toda la ventana en lugar de permitir bursts al reinicio.
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "nibble:rl",
  });
  upstashCache.set(key, limiter);
  return limiter;
}

// ============== API pública ==============

export type RateLimitResult = {
  success: boolean;
  used: number;
  limit: number;
  /** ms hasta que se libera el próximo slot. */
  retryAfter: number;
};

/**
 * Consume un token del bucket identificado por `key`.
 * Si excede el límite dentro de `windowMs`, retorna success=false.
 *
 *   const result = await rateLimit(`login:${ip}`, 5, 60_000);
 *   if (!result.success) return { error: rateLimitErrorMessage(result.retryAfter) };
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(limit, windowMs);
  if (upstash) {
    const r = await upstash.limit(key);
    return {
      success: r.success,
      used: limit - r.remaining,
      limit,
      retryAfter: Math.max(0, r.reset - Date.now()),
    };
  }

  // Fallback in-memory
  const now = Date.now();
  if (++consumeCounter % SWEEP_EVERY === 0) sweepMemory(now);

  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, used: 1, limit, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      used: existing.count,
      limit,
      retryAfter: existing.resetAt - now,
    };
  }

  existing.count++;
  return { success: true, used: existing.count, limit, retryAfter: 0 };
}

/**
 * Devuelve la IP del cliente leyendo headers proxy-aware.
 *
 * Orden de preferencia:
 *  1. `x-forwarded-for` (primer valor — el cliente real)
 *  2. `x-real-ip` (común en nginx/Caddy)
 *  3. fallback "unknown"
 *
 * En entornos sin proxy, retornará "unknown" — igual sirve como key compartido,
 * con el costo de que todo el server local cuenta como un solo "cliente".
 */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) {
      const first = fwd.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  } catch {
    // headers() falla en contextos sin request — caemos al fallback
  }
  return "unknown";
}

/** Helper para extraer IP desde un Request directamente. */
export function getClientIpFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Errores legibles de rate limit. */
export function rateLimitErrorMessage(retryAfterMs: number): string {
  const sec = Math.ceil(retryAfterMs / 1000);
  if (sec < 60) return `Demasiados intentos. Probá de nuevo en ${sec} segundo${sec === 1 ? "" : "s"}.`;
  const min = Math.ceil(sec / 60);
  return `Demasiados intentos. Probá de nuevo en ${min} minuto${min === 1 ? "" : "s"}.`;
}
