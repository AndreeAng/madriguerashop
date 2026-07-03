import "server-only";

/**
 * Cliente HTTP read-only para `cat.quick.com.bo`.
 *
 * Quick.com.bo es una plataforma SaaS de tiendas (competidora). Su frontend
 * Vue.js consume estos endpoints públicos:
 *
 *   POST /my-store           (body: slug=...)  → categorías + productos por página
 *   GET  /store-data/{slug}                    → branding + horarios + about
 *   GET  /list-products/{categoryId}?page=N    → productos por categoría
 *   GET  /show-product/{id}                    → detalle con gallery
 *
 * Solo lo usamos desde el panel de super-admin para importar tiendas que
 * el dueño quiere migrar a Madriguera. No es scraping agresivo: cada call
 * es JSON liviano que el frontend de Quick ya hace todo el tiempo. Igual
 * espaciamos los requests para no parecer DoS.
 */

const BASE = "https://cat.quick.com.bo";
// UA browser-like — un UA tipo "MadrigueraImporter/1.0" lo loguea Quick
// como bot y bajo carga puede empezar a rate-limitarnos o devolver 403.
// Con UA de Chrome real recibimos el mismo trato que cualquier visitor.
const USER_AGENT =
  "Mozilla/5.0 (compatible; MadrigueraBot/1.0; +https://madrigueras.shop)";

// Pausa entre requests para no martillar el origen. 200ms = ~5 req/s.
const REQUEST_DELAY_MS = 200;

// Timeout por imagen — algunos hosts tardan en responder. Sin esto, una
// imagen colgada bloqueaba todo el batch hasta el timeout de la función.
const IMAGE_FETCH_TIMEOUT_MS = 8000;

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

// ============== Shapes (lo que Quick devuelve) ==============

export type QuickProduct = {
  id: number;
  name: string;
  description: string | null; // HTML
  price: number | null;
  special_price: number | null;
  banner: string | null;
  state: number; // 1 = activo
  code: string | null;
};

export type QuickCategory = {
  id: number;
  store_id: number;
  name: string;
  slug: string;
  order: number;
  state: number;
  parent_id: number | null;
  products: QuickProduct[];
  products_count?: number;
  children: QuickCategory[];
};

export type QuickStoreBranding = {
  logo: string | null;
  banner: string | null;
  favicon: string | null;
  phone: string | null;
  description: string | null;
  storeName: string | null;
};

// ============== Fetchers ==============

// Timeout por request al API de Quick. Sin esto, un endpoint del competidor
// que tarda 55s puede bloquear el worker serverless hasta `maxDuration`
// sin posibilidad de cancelar — el cron de import se cae sin partial data.
const FETCH_JSON_TIMEOUT_MS = 15_000;

async function fetchJson<T>(
  url: string,
  init?: { method?: "GET" | "POST"; body?: URLSearchParams },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_JSON_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init?.body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: init?.body,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Quick API ${res.status} en ${url}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Quick API timeout (>${FETCH_JSON_TIMEOUT_MS / 1000}s) en ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Trae branding + nombre + teléfono del store. El endpoint devuelve un
 * array tuple raro: `[storeDesignObj, hoursArr, phone, name, pages, ...]`.
 * Lo normalizamos.
 */
export async function fetchQuickStoreData(slug: string): Promise<QuickStoreBranding> {
  const raw = await fetchJson<unknown[]>(`${BASE}/store-data/${slug}`);
  if (!Array.isArray(raw)) {
    return { logo: null, banner: null, favicon: null, phone: null, description: null, storeName: null };
  }
  const design = raw[0] as
    | {
        logo?: string | null;
        banner?: string | null;
        favicon?: string | null;
        description_store?: string | null;
      }
    | undefined;
  const phone = typeof raw[2] === "string" ? raw[2] : null;
  const storeName = typeof raw[3] === "string" ? raw[3] : null;

  return {
    logo: cleanUrl(design?.logo ?? null),
    banner: cleanUrl(design?.banner ?? null),
    favicon: cleanUrl(design?.favicon ?? null),
    phone,
    description:
      design?.description_store && design.description_store !== "null"
        ? design.description_store
        : null,
    storeName,
  };
}

/**
 * Trae TODAS las categorías de un store, con su primera página de
 * productos embebida. La paginación es por categoría — si una cat tiene
 * más productos que los embebidos, los completamos con `fetchCategoryProducts`.
 */
export async function fetchQuickCatalog(slug: string): Promise<QuickCategory[]> {
  const all: QuickCategory[] = [];
  let page = 1;
  // Cap defensivo: 50 páginas × ~10 cats/page = 500 categorías por tienda.
  // Si una tienda real lo excede, es probable un loop infinito en el server.
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const body = new URLSearchParams({ slug, page: String(page) });
    const raw = await fetchJson<unknown[]>(`${BASE}/my-store`, {
      method: "POST",
      body,
    });
    // Shape: `[ {current_page, last_page, data: QuickCategory[]} ]`
    const paginated = (raw?.[0] ?? {}) as {
      current_page?: number;
      last_page?: number;
      data?: QuickCategory[];
    };
    const batch = paginated.data ?? [];
    if (batch.length === 0) break;
    all.push(...batch);

    const last = paginated.last_page ?? 1;
    if (page >= last) break;
    page++;
    await delay(REQUEST_DELAY_MS);
  }
  return all;
}

/**
 * Si una categoría tiene `products_count > products.length`, hay más
 * productos paginados detrás. Trae todas las páginas restantes.
 */
export async function fetchCategoryProducts(
  categoryId: number,
  startPage = 2,
): Promise<QuickProduct[]> {
  const all: QuickProduct[] = [];
  let page = startPage;
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    type ListResp = {
      current_page: number;
      last_page: number;
      data: QuickProduct[];
    };
    const resp = await fetchJson<ListResp>(
      `${BASE}/list-products/${categoryId}?page=${page}`,
    );
    const batch = resp.data ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (page >= resp.last_page) break;
    page++;
    await delay(REQUEST_DELAY_MS);
  }
  return all;
}

/**
 * Resultado discriminado de descargar una imagen. Antes esta función
 * devolvía `Buffer | null` y tragaba el error con `catch {}` — los
 * warnings del importer decían "no descargó" sin más contexto, haciendo
 * imposible diagnosticar (timeout? 403? content-type bad? DNS?).
 */
export type ImageFetchResult =
  | { ok: true; buffer: Buffer; mime: string }
  | { ok: false; error: string };

/**
 * Descarga la imagen como Buffer. La pasamos a `saveImage` envuelta en
 * un `File` (Node 20+ tiene File nativo) para reusar el pipeline de
 * sharp + WebP del upload normal.
 *
 * Headers `Referer` + `Accept`: algunos hosts implementan hotlink
 * protection o esperan que el cliente declare qué tipo de respuesta
 * quiere — los agregamos para parecer browser real bajo todo escenario.
 */
/**
 * Bloquea SSRF: allowlist estricta de hosts de Quick + verificación
 * literal IP. DNS rebinding sigue siendo teóricamente posible si Quick
 * rota a IPs privadas, pero el riesgo se minimiza con la allowlist de
 * hosts conocidos (CDN público de Quick).
 */
const ALLOWED_IMAGE_HOSTS = new Set<string>([
  "cat.quick.com.bo",
  "quick.com.bo",
  "static.quick.com.bo",
  "cdn.quick.com.bo",
  "imgix.quick.com.bo",
  "d3sf8nszid9hb1.cloudfront.net", // CDN observado para Quick assets
]);

function isUrlSafeForFetch(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0") return false;
  // Hostnames con IP literal IPv4: rechazar privados/loopback/link-local.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    // Cualquier IP literal directa es sospechosa para imágenes de catálogo;
    // bloqueamos privados Y públicos para forzar resolución por hostname.
    const [, a, b] = ipv4.map(Number) as [number, number, number, number, number];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    // Para URLs con IP literal pública, también rechazamos — el caller
    // legítimo siempre debe usar hostname registrado.
    return false;
  }
  // IPv6 loopback / unique-local
  if (host === "::1" || host === "[::1]") return false;
  if (host.startsWith("fc") || host.startsWith("fd")) return false;
  // Allowlist estricta para imágenes — bloquea DNS rebinding (hostname
  // arbitrario que resuelve a IP privada en runtime).
  return ALLOWED_IMAGE_HOSTS.has(host);
}

// Cap del tamaño de la respuesta antes de buffer-izar. Sin esto, un host
// remoto puede devolver un stream de 500 MB y volar RAM antes de que el
// check de `MAX_UPLOAD_SIZE_MB` posterior tenga oportunidad de actuar.
const IMAGE_FETCH_MAX_BYTES = 10 * 1024 * 1024;

export async function fetchImageBuffer(url: string): Promise<ImageFetchResult> {
  if (!isUrlSafeForFetch(url)) {
    return { ok: false, error: "URL bloqueada (no https o host privado)" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/png,image/jpeg,image/webp,image/*;q=0.8,*/*;q=0.5",
        Referer: `${BASE}/`,
      },
      cache: "no-store",
      signal: controller.signal,
      // `redirect: "manual"` desactiva el seguimiento automático de
      // redirects. Si Quick devuelve 3xx, lo trataremos como error en
      // lugar de seguir ciegamente — el target podría ser metadata IP
      // (DNS rebinding adversario o CDN comprometido).
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: `redirect bloqueado (HTTP ${res.status})` };
    }
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      return {
        ok: false,
        error: `content-type no es imagen (recibido "${ct.slice(0, 40)}")`,
      };
    }
    // Validar Content-Length antes de descargar — fuente confiable para
    // hosts bien comportados (CDN de Quick). Si está ausente seguimos y
    // controlamos durante el read.
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > IMAGE_FETCH_MAX_BYTES) {
      return {
        ok: false,
        error: `imagen muy grande (${(contentLength / 1024 / 1024).toFixed(1)} MB > 10 MB)`,
      };
    }
    const arr = await res.arrayBuffer();
    if (arr.byteLength > IMAGE_FETCH_MAX_BYTES) {
      return {
        ok: false,
        error: `imagen muy grande tras descargar (${(arr.byteLength / 1024 / 1024).toFixed(1)} MB)`,
      };
    }
    if (arr.byteLength === 0) {
      return { ok: false, error: "respuesta vacía (0 bytes)" };
    }
    return { ok: true, buffer: Buffer.from(arr), mime: ct };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted")) {
      return { ok: false, error: `timeout (>${IMAGE_FETCH_TIMEOUT_MS / 1000}s)` };
    }
    return { ok: false, error: `fetch falló: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Quick guarda algunas URLs como `null` literal string o vacías. */
function cleanUrl(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v === "" || v === "null") return null;
  if (v.includes("bg-store.jpg") || v.includes("logo-default")) return null;
  return v;
}
