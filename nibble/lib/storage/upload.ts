import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { put, del } from "@vercel/blob";

/**
 * Almacenamiento de imágenes — dual-mode (Vercel Blob vs filesystem).
 *
 * Vercel serverless tiene filesystem read-only excepto `/tmp` (que además se
 * pierde entre invocaciones). Cualquier `writeFile` en `public/uploads/` o
 * `private-uploads/` falla con `ENOENT: mkdir '/var/task/...'`. Por eso en
 * producción guardamos en Vercel Blob (CDN-backed object storage).
 *
 * Modo se elige por presencia de `BLOB_READ_WRITE_TOKEN`:
 *   - Token presente  → Vercel Blob (URL pública servida desde edge CDN).
 *   - Token ausente   → filesystem local (dev sin configurar Blob).
 *
 * Para comprobantes de pago (`kind: "proof"`) en modo Blob: los guardamos
 * con `access: "public"` pero el path incluye un UUID aleatorio que actúa
 * como token unguessable (~122 bits de entropía). Solo quien obtuvo la URL
 * vía el flujo autenticado (customer ↔ admin) la conoce. No es defensa
 * contra exfiltración deliberada de URLs — para eso habría que migrar a
 * Blob privado (beta) o S3 con signed URLs. Para MVP es aceptable.
 */

export type ImageKind = "logo" | "banner" | "favicon" | "product" | "qr" | "category" | "proof";

const KIND_LIMITS: Record<ImageKind, { maxWidth: number; quality: number }> = {
  logo: { maxWidth: 512, quality: 90 },
  banner: { maxWidth: 1920, quality: 82 },
  favicon: { maxWidth: 256, quality: 90 },
  product: { maxWidth: 1600, quality: 82 },
  qr: { maxWidth: 1024, quality: 92 }, // QRs necesitan más definición
  category: { maxWidth: 800, quality: 85 },
  proof: { maxWidth: 1600, quality: 80 }, // comprobantes — legibilidad sin tamaño excesivo
};

// Subdirectorio por kind para no mezclar (ej. proof en su propio path,
// separado de los QRs propios de la tienda).
const KIND_SUBDIR: Partial<Record<ImageKind, string>> = {
  proof: "proof",
};

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // "RIFF" header — WebP completo necesita "WEBP" en bytes 8-11
};

// Activamos Vercel Blob cuando hay token. En dev sin token, fallback a fs.
// (No usamos `useXxx` como nombre porque ESLint cree que es un React Hook.)
const isBlobMode = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function publicBaseUrl(): string {
  return process.env.PUBLIC_UPLOADS_URL || "/uploads";
}

/**
 * Directorio para comprobantes de pago en modo filesystem. SIEMPRE fuera de
 * `public/` para que Next.js / nginx no los sirvan directamente. Se sirven
 * por el route handler `/api/uploads/proof/[...path]` con auth.
 *
 * En modo Blob este directorio no se usa — los proofs viven en Blob con un
 * path que incluye UUID unguessable.
 */
export function proofUploadDir(): string {
  return (
    process.env.PROOF_UPLOAD_DIR ||
    path.join(process.cwd(), "private-uploads", "proof")
  );
}

function maxSizeBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_SIZE_MB) || 5;
  return mb * 1024 * 1024;
}

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Validación de magic bytes — más confiable que el MIME type del cliente
 * (que es trivialmente falsificable).
 */
function detectImageType(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (startsWithBytes(buf, MAGIC_BYTES.jpeg)) return "jpeg";
  if (startsWithBytes(buf, MAGIC_BYTES.png)) return "png";
  if (
    startsWithBytes(buf, MAGIC_BYTES.webp) &&
    buf.length >= 12 &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export class UploadError extends Error {
  constructor(
    public code:
      | "too_large"
      | "bad_mime"
      | "bad_content"
      | "io_error",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Guarda una imagen subida. Valida tamaño + magic bytes, optimiza con sharp,
 * convierte a WebP/PNG y delega el storage según `isBlobMode()`.
 *
 * @param file - Web File (vienen de FormData en route handlers / server actions)
 * @param ownerId - prefijo de directorio (típicamente storeId)
 * @param kind - tipo lógico, define límites de tamaño
 */
export async function saveImage(
  file: File,
  ownerId: string,
  kind: ImageKind,
): Promise<{ url: string; bytes: number }> {
  // 1. Tamaño bruto
  if (file.size > maxSizeBytes()) {
    throw new UploadError(
      "too_large",
      `Imagen demasiado grande. Máx ${maxSizeBytes() / 1024 / 1024} MB.`,
    );
  }

  // 2. MIME del cliente (filtro barato)
  if (!ACCEPTED_MIME.has(file.type)) {
    throw new UploadError(
      "bad_mime",
      "Sólo se aceptan imágenes JPG, PNG o WebP.",
    );
  }

  // 3. Magic bytes (filtro real)
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new UploadError(
      "bad_content",
      "El archivo no es una imagen válida.",
    );
  }

  // 4. Optimizar con sharp
  const limits = KIND_LIMITS[kind];
  let pipeline = sharp(buffer, { failOn: "error" })
    .rotate() // respeta EXIF orientation y luego strip
    .resize({
      width: limits.maxWidth,
      height: limits.maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: limits.quality });

  // Para favicons preferimos PNG (mejor compatibilidad de browsers)
  let outputExt: "webp" | "png" = "webp";
  if (kind === "favicon") {
    pipeline = sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({ width: limits.maxWidth, height: limits.maxWidth, fit: "inside" })
      .png({ compressionLevel: 9 });
    outputExt = "png";
  }

  let output: Buffer;
  try {
    output = await pipeline.toBuffer();
  } catch {
    throw new UploadError(
      "bad_content",
      "No pudimos procesar la imagen. Prueba con otra.",
    );
  }

  // 5. Anti path-traversal en ownerId. CUIDs/UUIDs son seguros, pero validamos
  // explícitamente para que un bug upstream no se convierta en RCE.
  if (!/^[a-zA-Z0-9_-]+$/.test(ownerId)) {
    throw new UploadError("bad_content", "ownerId inválido");
  }

  const id = crypto.randomUUID();
  const filename = `${id}.${outputExt}`;
  const isPrivate = kind === "proof";
  // Path lógico: comparten estructura ambos modos para uniformidad.
  //   public:  uploads/<ownerId>/[kind-subdir]/<uuid>.ext
  //   private: proof/<ownerId>/<uuid>.ext
  const segments = isPrivate
    ? [ownerId]
    : KIND_SUBDIR[kind]
      ? [ownerId, KIND_SUBDIR[kind]!]
      : [ownerId];

  const contentType = outputExt === "png" ? "image/png" : "image/webp";

  if (isBlobMode()) {
    // Vercel Blob: clave global en el bucket, URL devuelta apunta a CDN edge.
    const blobKey = (isPrivate ? ["proof", ...segments, filename] : ["uploads", ...segments, filename]).join("/");
    try {
      const result = await put(blobKey, output, {
        access: "public",
        contentType,
        // Sin sufijo aleatorio — ya garantizamos unicidad con `crypto.randomUUID()`
        // en el filename. Si activáramos `addRandomSuffix` Blob agregaría OTRO
        // sufijo encima, lo cual ensucia la URL sin ganancia.
        addRandomSuffix: false,
      });
      return { url: result.url, bytes: output.length };
    } catch (err) {
      // Loguear el detalle real del fallo de Blob solo en server-side —
      // si propagamos `err.message` al caller, callers que hacen
      // `catch(e) { return { error: e.message } }` lo enseñan al cliente,
      // exponiendo internals de Vercel (paths, tokens, etc.).
      console.error("[upload] vercel-blob put failed", {
        message: (err as Error).message,
      });
      throw new UploadError(
        "io_error",
        "No pudimos guardar la imagen. Intenta de nuevo.",
      );
    }
  }

  // Fallback filesystem (dev local). NO funciona en Vercel serverless.
  const baseDir = isPrivate ? proofUploadDir() : uploadDir();
  const dir = path.join(baseDir, ...segments);
  const filePath = path.join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, output);
  } catch (err) {
    // Loguear detalle (con path absoluto) solo server-side. El caller
    // puede serializar `UploadError.message` al cliente, así que el
    // mensaje user-facing es genérico.
    console.error("[upload] fs write failed", {
      message: (err as Error).message,
    });
    throw new UploadError(
      "io_error",
      "No pudimos guardar la imagen. Intenta de nuevo.",
    );
  }

  const urlPath = isPrivate
    ? ["/api/uploads/proof", ...segments, filename].join("/")
    : [publicBaseUrl().replace(/\/$/, ""), ...segments, filename].join("/");

  return { url: urlPath, bytes: output.length };
}

/**
 * Versión "raw" de `saveImage` — guarda los bytes tal cual, sin pasar por
 * sharp. Pensada para imports masivos donde los bytes ya vienen optimizados
 * desde la fuente (otra plataforma de e-commerce, Cloudinary, etc.) y el
 * costo de CPU de sharp (≈300ms por imagen) se traduce en timeouts cuando
 * importamos decenas o cientos de fotos contra el límite serverless.
 *
 * Trade-off explícito vs `saveImage`:
 *   - Tamaño: las imágenes pueden ser MÁS PESADAS (no las convertimos a
 *     WebP ni redimensionamos al ancho del kind). Estimación: x2-3 bytes
 *     sobre una optimizada.
 *   - Quality: si la fuente sirve PNG sin compresión o JPG al 100%, eso
 *     se preserva tal cual.
 *   - Mime: se mantiene el original (JPG, PNG, WebP). Sin conversión.
 *
 * Lo que SÍ valida (mismo nivel de seguridad que saveImage):
 *   - Tamaño máximo (`MAX_UPLOAD_SIZE_MB`).
 *   - Magic bytes (rechazo bytes que no son imagen).
 *   - ownerId regex (anti path-traversal).
 *
 * Para una segunda pasada de optimización fuera del path crítico del
 * import, ver el roadmap: un cron job podría re-encodear con sharp.
 */
export async function saveImageRaw(
  buffer: Buffer,
  contentType: string,
  ownerId: string,
  kind: ImageKind,
): Promise<{ url: string; bytes: number }> {
  if (buffer.length > maxSizeBytes()) {
    throw new UploadError(
      "too_large",
      `Imagen demasiado grande. Máx ${maxSizeBytes() / 1024 / 1024} MB.`,
    );
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    throw new UploadError("bad_content", "El archivo no es una imagen válida.");
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(ownerId)) {
    throw new UploadError("bad_content", "ownerId inválido");
  }

  // Whitelist explícita de MIMEs raster. Rechazamos SVG en particular:
  // un SVG con un `<script>` embebido se sirve desde Vercel Blob con
  // su MIME real y ejecuta JS en el contexto del dominio público —
  // XSS clásico. Limitamos también a los formatos que `detectImageType`
  // sabe identificar por magic bytes, evitando aceptar contentTypes
  // confiables que el contenido no respalda.
  const ALLOWED_RASTER_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  const declaredAllowed =
    ACCEPTED_MIME.has(contentType) && ALLOWED_RASTER_MIME.has(contentType);
  const finalContentType = declaredAllowed
    ? contentType
    : detected === "jpeg"
      ? "image/jpeg"
      : detected === "png"
        ? "image/png"
        : "image/webp";

  const ext = detected === "jpeg" ? "jpg" : detected;
  const id = crypto.randomUUID();
  const filename = `${id}.${ext}`;
  const isPrivate = kind === "proof";
  const segments = isPrivate
    ? [ownerId]
    : KIND_SUBDIR[kind]
      ? [ownerId, KIND_SUBDIR[kind]!]
      : [ownerId];

  if (isBlobMode()) {
    const blobKey = (isPrivate
      ? ["proof", ...segments, filename]
      : ["uploads", ...segments, filename]
    ).join("/");
    try {
      const result = await put(blobKey, buffer, {
        access: "public",
        contentType: finalContentType,
        addRandomSuffix: false,
      });
      return { url: result.url, bytes: buffer.length };
    } catch (err) {
      console.error("[upload-raw] vercel-blob put failed", {
        message: (err as Error).message,
      });
      throw new UploadError(
        "io_error",
        "No pudimos guardar la imagen. Intenta de nuevo.",
      );
    }
  }

  const baseDir = isPrivate ? proofUploadDir() : uploadDir();
  const dir = path.join(baseDir, ...segments);
  const filePath = path.join(dir, filename);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);
  } catch (err) {
    throw new UploadError(
      "io_error",
      `Error guardando la imagen: ${(err as Error).message}`,
    );
  }

  const urlPath = isPrivate
    ? ["/api/uploads/proof", ...segments, filename].join("/")
    : [publicBaseUrl().replace(/\/$/, ""), ...segments, filename].join("/");

  return { url: urlPath, bytes: buffer.length };
}

/**
 * Borra una imagen de Vercel Blob si la URL parece ser un blob hosteado.
 * Para URLs locales (`/uploads/...`) no hace nada — el filesystem queda
 * para el cron de cleanup si lo hubiera. Best-effort: cualquier error se
 * loguea pero no se propaga al caller (la falla de cleanup no debe romper
 * el update del banner/popup que la generó).
 *
 * Sin esta función, cada update de banner/popup deja la imagen vieja
 * acumulada indefinidamente en Vercel Blob, inflando la factura del
 * comerciante.
 */
export async function deleteBlobIfHosted(url: string | null | undefined): Promise<void> {
  if (!url) return;
  if (!url.includes("blob.vercel-storage.com")) return;
  try {
    await del(url);
  } catch (err) {
    console.error("[storage] del() failed", {
      url,
      message: (err as Error).message,
    });
  }
}
