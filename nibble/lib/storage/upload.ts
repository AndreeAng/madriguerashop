import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

/**
 * Almacenamiento de imágenes — versión local filesystem.
 *
 * Por defecto guarda en `public/uploads/<storeId>/<uuid>.webp` y devuelve
 * `/uploads/<storeId>/<uuid>.webp` (Next.js sirve `public/` automáticamente).
 *
 * Producción: setear UPLOAD_DIR + PUBLIC_UPLOADS_URL para guardar en disco
 * fuera del repo (ej. /var/www/uploads montado por nginx).
 *
 * Roadmap: migrar a S3/R2 implementando el mismo `saveImage` con otra estrategia.
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

function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function publicBaseUrl(): string {
  return process.env.PUBLIC_UPLOADS_URL || "/uploads";
}

/**
 * Directorio para comprobantes de pago. SIEMPRE fuera de `public/` para
 * que Next.js / nginx no los sirvan directamente. Se sirven por el route
 * handler `/api/uploads/proof/[...path]` con auth.
 *
 * Default: `<cwd>/private-uploads/proof`. En producción se puede mover a
 * un volumen separado con `PROOF_UPLOAD_DIR`.
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
 * convierte a WebP, escribe a disco y devuelve la URL pública.
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
  let outputExt = "webp";
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
      "No pudimos procesar la imagen. Probá con otra.",
    );
  }

  // 5. Anti path-traversal en ownerId. CUIDs/UUIDs son seguros, pero validamos
  // explícitamente para que un bug upstream no se convierta en RCE.
  if (!/^[a-zA-Z0-9_-]+$/.test(ownerId)) {
    throw new UploadError("bad_content", "ownerId inválido");
  }

  // 6. Escribir a disco. Los comprobantes (`proof`) van a un directorio
  // PRIVADO y se sirven por route handler con auth. El resto son públicos
  // y los sirve Next.js / nginx directamente.
  const id = crypto.randomUUID();
  const filename = `${id}.${outputExt}`;

  const isPrivate = kind === "proof";
  const baseDir = isPrivate ? proofUploadDir() : uploadDir();
  const segments = isPrivate ? [ownerId] : KIND_SUBDIR[kind] ? [ownerId, KIND_SUBDIR[kind]!] : [ownerId];
  const dir = path.join(baseDir, ...segments);
  const filePath = path.join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, output);
  } catch (err) {
    throw new UploadError(
      "io_error",
      `Error guardando la imagen: ${(err as Error).message}`,
    );
  }

  // URL devuelta: pública para todo menos proof. Los proof van por el route
  // handler autenticado.
  const urlPath = isPrivate
    ? ["/api/uploads/proof", ...segments, filename].join("/")
    : [publicBaseUrl().replace(/\/$/, ""), ...segments, filename].join("/");

  return { url: urlPath, bytes: output.length };
}
