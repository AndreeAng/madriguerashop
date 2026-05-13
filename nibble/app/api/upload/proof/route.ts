import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveImage, UploadError } from "@/lib/storage/upload";
import {
  rateLimit,
  getClientIpFromRequest,
  rateLimitErrorMessage,
} from "@/lib/security/rateLimit";

/**
 * Endpoint público (sin auth) para que clientes finales suban su comprobante
 * de pago QR durante el checkout.
 *
 * - El slug se valida contra la DB para asegurar que la tienda existe y acepta pedidos.
 * - Las imágenes quedan en `<storeId>/proof-<uuid>.webp` — visible para el owner
 *   en /dashboard/pedidos.
 *
 * Riesgo conocido: cualquiera con el slug puede subir imágenes hasta 5 MB.
 * Mitigaciones: rate limit (Fase 1.7), validación de tamaño/MIME ya activas.
 */

export async function POST(request: Request) {
  // Validar Origin contra APP_URL — endpoint público pero sólo para nuestro
  // frontend. En producción exigimos que el header Origin exista y matchee.
  // Sin esta exigencia, un atacante con `curl` (que omite Origin por default)
  // bypassea el check porque `null !== expectedOrigin` cae en condición falsy
  // cuando se mezcla con `&& origin`.
  if (process.env.NODE_ENV === "production") {
    const origin = request.headers.get("origin");
    const expectedOrigin = process.env.APP_URL?.replace(/\/$/, "");
    if (!expectedOrigin || !origin || origin !== expectedOrigin) {
      return NextResponse.json({ error: "Origin no permitido" }, { status: 403 });
    }
  }

  // Rate limit por IP — 20 uploads / 10 min es suficiente para flujos legítimos
  // y bloquea bots subiendo basura masiva.
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimit(`upload-proof:${ip}`, 20, 10 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: rateLimitErrorMessage(rl.retryAfter) },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
  }

  const store = await db.store.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!store) {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  }
  if (store.status === "SUSPENDED" || store.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Esta tienda no acepta pedidos" },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  try {
    const result = await saveImage(file, store.id, "proof");
    return NextResponse.json({ url: result.url, bytes: result.bytes });
  } catch (err) {
    if (err instanceof UploadError) {
      const status = err.code === "io_error" ? 500 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Proof upload error:", err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
