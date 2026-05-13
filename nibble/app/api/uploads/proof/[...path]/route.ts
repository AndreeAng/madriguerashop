import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { proofUploadDir } from "@/lib/storage/upload";

/**
 * Sirve comprobantes de pago con auth. El archivo vive fuera de `public/`
 * para que ni Next.js ni nginx lo expongan directamente — sólo se accede
 * por este endpoint.
 *
 * Reglas de acceso al archivo `/api/uploads/proof/<storeId>/<filename>`:
 *   - SUPER_ADMIN siempre puede ver (cobranzas SaaS).
 *   - STORE_OWNER / CASHIER pueden ver si su sesión está scoped al `storeId`.
 *   - CUSTOMER del pedido puede ver pasando `?t=<trackingToken>` (el mismo
 *     token que protege /[slug]/orden/[token]). El token es unguessable y
 *     único por pedido — equivale a "demostrar que sos el dueño del pedido".
 *   - Resto: 403.
 */

const ALLOWED_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  // Esperamos al menos [storeId, filename]
  if (!Array.isArray(segments) || segments.length < 2) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  const storeId = segments[0];
  const relPath = segments.slice(1).join("/");

  // Validaciones anti path-traversal antes de tocar el filesystem.
  if (!storeId || !/^[a-zA-Z0-9_-]+$/.test(storeId)) {
    return NextResponse.json({ error: "storeId inválido" }, { status: 400 });
  }
  if (
    relPath.includes("..") ||
    relPath.includes("\\") ||
    relPath.startsWith("/") ||
    relPath.length === 0
  ) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  const ext = path.extname(relPath).toLowerCase();
  const contentType = ALLOWED_EXT[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Tipo no permitido" }, { status: 400 });
  }

  // Auth check: session OR trackingToken para el dueño del pedido.
  const session = await auth();
  const u = session?.user;
  const isSuperAdmin = u?.role === Role.SUPER_ADMIN;
  const isStoreMember =
    !!u &&
    (u.role === Role.STORE_OWNER || u.role === Role.CASHIER) &&
    u.storeId === storeId;

  let isOrderOwner = false;
  if (!isSuperAdmin && !isStoreMember) {
    const trackingToken = new URL(req.url).searchParams.get("t");
    if (trackingToken && /^[a-zA-Z0-9_-]{16,}$/.test(trackingToken)) {
      // El token es único por pedido — si el path del proof coincide con
      // el paymentProofUrl del pedido y el token apunta al mismo pedido,
      // el cliente tiene derecho a ver su propio comprobante.
      const expectedSuffix = `/${storeId}/${relPath}`;
      const order = await db.order.findUnique({
        where: { trackingToken },
        select: { storeId: true, paymentProofUrl: true },
      });
      if (
        order &&
        order.storeId === storeId &&
        order.paymentProofUrl?.endsWith(expectedSuffix)
      ) {
        isOrderOwner = true;
      }
    }
  }

  if (!isSuperAdmin && !isStoreMember && !isOrderOwner) {
    return NextResponse.json(
      { error: u ? "No autorizado" : "No autenticado" },
      { status: u ? 403 : 401 },
    );
  }

  // Resolver ruta real y verificar que cae dentro del baseDir (defensa en
  // profundidad contra path-traversal por si las validaciones de arriba
  // tienen algún edge case).
  const baseDir = path.resolve(proofUploadDir());
  const filePath = path.resolve(baseDir, storeId, relPath);
  if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
