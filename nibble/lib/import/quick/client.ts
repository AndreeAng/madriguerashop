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
  price: number;
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

async function fetchJson<T>(
  url: string,
  init?: { method?: "GET" | "POST"; body?: URLSearchParams },
): Promise<T> {
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
  });
  if (!res.ok) {
    throw new Error(`Quick API ${res.status} en ${url}`);
  }
  return res.json() as Promise<T>;
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
export async function fetchImageBuffer(url: string): Promise<ImageFetchResult> {
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
    });
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
    const arr = await res.arrayBuffer();
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

/**
 * Convierte un Buffer en `File` para alimentar el pipeline de `saveImage`.
 * Necesario porque `saveImage` toma `File` del FormData del browser; acá
 * el "archivo" viene de un download HTTP en el server.
 */
export function bufferToFile(
  buffer: Buffer,
  filename: string,
  mime: string,
): File {
  // Node 20+ tiene `File` global. `Buffer` extiende `Uint8Array` pero TS lo
  // tipa con `ArrayBufferLike`, incompatible con `BlobPart` cuando el target
  // buffer es `ArrayBuffer` puro — el cast a `Uint8Array` lo alinea sin
  // copia de datos (misma memoria).
  const bytes = new Uint8Array(buffer);
  return new File([bytes], filename, { type: mime });
}

/** Quick guarda algunas URLs como `null` literal string o vacías. */
function cleanUrl(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v === "" || v === "null") return null;
  if (v.includes("bg-store.jpg") || v.includes("logo-default")) return null;
  return v;
}
