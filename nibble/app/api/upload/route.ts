import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { saveImage, UploadError, type ImageKind } from "@/lib/storage/upload";
import { rateLimit, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { captureError } from "@/lib/observability/captureError";
import { readImpersonatedStoreId } from "@/lib/auth/impersonation";

const ALLOWED_KINDS: ImageKind[] = ["logo", "banner", "favicon", "product", "qr", "category"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== Role.STORE_OWNER && role !== Role.CASHIER && role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Resolver storeId: si SUPER_ADMIN está impersonando una tienda demo,
  // la cookie de impersonation define a qué tienda van los uploads. Sin
  // este resolve, el admin que configura una tienda no puede subir banners.
  let storeId = session.user.storeId;
  if (!storeId && role === Role.SUPER_ADMIN) {
    storeId = await readImpersonatedStoreId();
    // Validar que la tienda impersonada existe en DB. Sin este check, una
    // cookie alterada por un XSS hipotético llevaría los uploads a un
    // directorio bajo cualquier `storeId` arbitrario en el filesystem.
    if (storeId) {
      const exists = await db.store.findUnique({
        where: { id: storeId },
        select: { id: true },
      });
      if (!exists) storeId = null;
    }
  }
  if (!storeId) {
    return NextResponse.json({ error: "Sin tienda asociada" }, { status: 400 });
  }

  // Rate limit por usuario (no IP) — 60/min generoso para edición masiva
  const rl = await rateLimit(`upload:${session.user.id}`, 60, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: rateLimitErrorMessage(rl.retryAfter) },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.includes(kind as ImageKind)) {
    return NextResponse.json({ error: "Tipo de imagen inválido" }, { status: 400 });
  }

  try {
    const result = await saveImage(file, storeId, kind as ImageKind);
    return NextResponse.json({ url: result.url, bytes: result.bytes });
  } catch (err) {
    if (err instanceof UploadError) {
      const status = err.code === "io_error" ? 500 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    captureError(err, { route: "/api/upload", storeId });
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
