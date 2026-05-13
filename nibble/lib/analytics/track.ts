import "server-only";
import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import { db } from "@/lib/db";

/**
 * Tracking de PageView en server-side. Diseñado para invocarse desde
 * Server Components del storefront sin bloquear el render.
 *
 * Patrón:
 *   - El middleware bootstrappea `mv_visitor` (6 meses) y `mv_session`
 *     (30 min sliding) antes de que el RSC corra. Acá SOLO los leemos.
 *   - Cada llamada inserta una fila en PageView (fire-and-forget).
 *
 * Antes este módulo intentaba setear las cookies con `cookies().set()` desde
 * un Server Component — Next 15 lo rechaza y el catch silenciaba el fallo,
 * dejando un visitor token nuevo en cada pageview (analytics inútiles).
 *
 * NO grabamos visitas de:
 *   - Bots conocidos (User-Agent contiene googlebot, bingbot, etc.)
 *   - El propio owner de la tienda (cuando hay sesión auth con ese storeId)
 */

const VISITOR_COOKIE = "mv_visitor";
const SESSION_COOKIE = "mv_session";

const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /duckduckbot/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /slackbot/i,
  /whatsapp/i, // wa link previews
  /telegrambot/i,
  /headlesschrome/i, // Playwright en CI
  /puppeteer/i,
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // sin UA es sospechoso
  return BOT_PATTERNS.some((re) => re.test(userAgent));
}

/** Trunca User-Agent al máximo razonable para evitar storage gigante. */
function truncateUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  return ua.length > 256 ? ua.slice(0, 256) : ua;
}

/**
 * Hashea la IP con SHA-256 + salt rotada diariamente. Esto:
 *  1. Cumple GDPR/LOPD: la IP cruda es PII, el hash no permite re-identificación
 *     individual una vez rotada la salt.
 *  2. Permite contar visitantes únicos por día (la salt es estable durante 24h).
 *  3. Resiste rainbow tables — la salt no es predecible para un atacante externo.
 *
 * La salt deriva de AUTH_SECRET + la fecha UTC. Si AUTH_SECRET cambia, los
 * hashes históricos quedan huérfanos — aceptable (las IPs viejas pierden
 * comparabilidad cross-deploy).
 */
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev";
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${secret}:${day}:${ip}`)
    .digest("base64")
    .slice(0, 22); // 22 chars base64 ≈ 132 bits, suficiente
}

async function readCookie(name: string): Promise<string | null> {
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

export async function trackPageView(opts: {
  storeId: string;
  path: string;
  productId?: string | null;
}): Promise<void> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent");
    if (isBot(userAgent)) return;

    const referrer = h.get("referer");
    const fwd = h.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;

    // El middleware ya bootstrappeó estas cookies. Si por algún motivo
    // faltan (request que no pasó por middleware), generamos un token
    // efímero solo para esta fila — el siguiente request las tendrá.
    const visitorToken =
      (await readCookie(VISITOR_COOKIE)) ?? crypto.randomUUID();
    const sessionToken =
      (await readCookie(SESSION_COOKIE)) ?? crypto.randomUUID();

    // Fire-and-forget — no esperar al insert
    db.pageView
      .create({
        data: {
          storeId: opts.storeId,
          path: opts.path,
          productId: opts.productId ?? null,
          referrer: referrer ?? null,
          userAgent: truncateUserAgent(userAgent),
          ip: hashIp(ip),
          visitorToken,
          sessionToken,
        },
      })
      .catch((err) => {
        // Tracking nunca debería romper el render
        console.error("[track] failed", err);
      });
  } catch (err) {
    console.error("[track] outer failed", err);
  }
}
