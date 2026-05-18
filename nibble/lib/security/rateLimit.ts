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
 * En producción serverless (Vercel, etc.) el rate limiter SIN Upstash es
 * decorativo — el atacante distribuye sus requests entre lambdas. Por eso
 * loguea WARN una vez por proceso al arrancar si está en ese estado, para
 * que aparezca en Sentry/logs y se note la mala configuración. NO tira al
 * startup porque algunos deploys legítimos (build/migrations) levantan el
 * runtime sin Redis para tareas no-críticas.
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

// Aviso único por proceso si estamos en producción sin Upstash. Sin esto,
// el `console.warn` por request inundaba los logs (un evento por cada hit
// a `rateLimit`). Detectamos vía bandera estática para que el log salga
// solo la primera vez que se entra al fallback in-memory en este worker.
let warnedNoRedisInProd = false;
function warnIfMisconfiguredOnce() {
  if (warnedNoRedisInProd) return;
  if (process.env.NODE_ENV !== "production") return;
  warnedNoRedisInProd = true;
  console.warn(
    "[rateLimit] UPSTASH_REDIS_REST_URL no está seteado en producción. " +
      "El rate limiter cae al fallback in-memory que NO funciona entre " +
      "lambdas/workers concurrentes — login, recovery y checkout quedan " +
      "expuestos a brute force. Configurar Upstash o sacar este servicio " +
      "de un entorno serverless.",
  );
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

  // Fallback in-memory. Si llegamos acá en producción, Upstash NO está
  // configurado y el limiter es decorativo en serverless — emitimos un
  // warn único para que se note en Sentry.
  warnIfMisconfiguredOnce();

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
 * SEGURIDAD: confiar en `x-forwarded-for` solo cuando estamos detrás de un
 * proxy que lo controle. En Vercel la plataforma garantiza el header. En
 * VPS con nginx, requiere `set_real_ip_from` + `real_ip_header` para que
 * nginx SOBREESCRIBA (no concatene) el header recibido del cliente. Si el
 * server está expuesto directo a internet, un atacante puede mandar
 * `x-forwarded-for: 1.2.3.4` y bypasea el rate limiter.
 *
 * Comportamiento:
 *  - Si `RATE_LIMIT_TRUST_PROXY === "true"` o estamos en Vercel
 *    (`process.env.VERCEL`), leemos el primer hop del header y validamos
 *    que sea una IP plausible (no `null`, no string vacío, no obvio
 *    garbage). Si la validación falla, caemos a "unknown" en vez de usar
 *    basura como key.
 *  - Si NO confiamos en proxy, ignoramos `x-forwarded-for` y devolvemos
 *    "unknown" — todo el tráfico cuenta como un cliente, lo que mantiene
 *    el rate limit funcionando como tope global.
 */
function trustProxy(): boolean {
  // Leemos las envs en cada llamada (no en module init) para que los tests
  // puedan stub-earlas con `vi.stubEnv` y los flips dinámicos funcionen.
  // El costo extra es despreciable — `process.env` es sincrónico y JS lo
  // cachea en una hash table.
  return (
    process.env.RATE_LIMIT_TRUST_PROXY === "true" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true"
  );
}

// Regex permisiva: acepta IPv4 (dotted-quad) y IPv6 (cualquier cosa con `:`).
// No validamos rangos exactos — solo descartamos garbage obvio que pueda
// inflar el Map del fallback in-memory con keys arbitrarias del header.
const IP_LIKE = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/;

/**
 * Extrae el primer valor de un header `x-forwarded-for` y valida que
 * parezca una IP. Exportado para tests — los callers de producción
 * usan `getClientIp` / `getClientIpFromRequest`.
 */
export function pickFirstIp(rawHeader: string | null): string | null {
  if (!rawHeader) return null;
  const first = rawHeader.split(",")[0]?.trim();
  if (!first) return null;
  if (first.length > 45) return null; // IPv6 más largo válido: 39 chars; margen para zonas
  if (!IP_LIKE.test(first)) return null;
  return first;
}

export async function getClientIp(): Promise<string> {
  if (!trustProxy()) return "unknown";
  try {
    const h = await headers();
    const fromXff = pickFirstIp(h.get("x-forwarded-for"));
    if (fromXff) return fromXff;
    const fromReal = pickFirstIp(h.get("x-real-ip"));
    if (fromReal) return fromReal;
  } catch {
    // headers() falla en contextos sin request — caemos al fallback
  }
  return "unknown";
}

/** Helper para extraer IP desde un Request directamente. */
export function getClientIpFromRequest(request: Request): string {
  if (!trustProxy()) return "unknown";
  const fromXff = pickFirstIp(request.headers.get("x-forwarded-for"));
  if (fromXff) return fromXff;
  const fromReal = pickFirstIp(request.headers.get("x-real-ip"));
  if (fromReal) return fromReal;
  return "unknown";
}

/** Errores legibles de rate limit. */
export function rateLimitErrorMessage(retryAfterMs: number): string {
  const sec = Math.ceil(retryAfterMs / 1000);
  if (sec < 60) return `Demasiados intentos. Prueba de nuevo en ${sec} segundo${sec === 1 ? "" : "s"}.`;
  const min = Math.ceil(sec / 60);
  return `Demasiados intentos. Prueba de nuevo en ${min} minuto${min === 1 ? "" : "s"}.`;
}
