import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { pickFirstIp, rateLimit } from "@/lib/security/rateLimit";
import { hashIp } from "@/lib/crypto/hashIp";

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
  // LLMs crawlers (alto tráfico en 2025-2026 sobre catálogos públicos)
  /gptbot/i,
  /chatgpt-user/i,
  /claudebot/i,
  /anthropic-ai/i,
  /perplexitybot/i,
  /youbot/i,
  // SEO/marketing crawlers
  /ahrefsbot/i,
  /semrushbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  // Otros agregadores
  /applebot/i,
  /bytespider/i, // TikTok
  /amazonbot/i,
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

// `hashIp` vive en `lib/crypto/hashIp` para que audit y analytics usen
// la misma implementación y la rotación de salt diaria sea consistente.

async function readCookie(name: string): Promise<string | null> {
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

const CONSENT_COOKIE = "mv_consent";

export async function trackPageView(opts: {
  storeId: string;
  path: string;
  productId?: string | null;
}): Promise<void> {
  try {
    // No trackeamos si el visitante no aceptó cookies analíticas. La
    // política de privacidad declara que solo trackeamos con consentimiento.
    // El banner `<CookieConsent>` setea `mv_consent="yes"` cuando acepta.
    const consent = await readCookie(CONSENT_COOKIE);
    if (consent !== "yes") return;

    const h = await headers();
    const userAgent = h.get("user-agent");
    if (isBot(userAgent)) return;

    const referrer = h.get("referer");
    // Validar el header con `pickFirstIp` evita garbage (XSS payloads en
    // x-forwarded-for) en la columna `PageView.ip` hasheada.
    const ip =
      pickFirstIp(h.get("x-forwarded-for")) ??
      pickFirstIp(h.get("x-real-ip"));

    // Protección contra flood: máx 30 pageviews/minuto por IP+tienda.
    // Bots que spoofean un UA real y fuerzan mv_consent=yes quedarían
    // bloqueados antes de llenar la tabla PageView.
    const rl = await rateLimit(
      `pageview:${ip ?? "noip"}:${opts.storeId}`,
      30,
      60 * 1000,
    );
    if (!rl.success) return;

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
