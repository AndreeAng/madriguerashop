import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Cron de cleanup de carritos vencidos — corre 1×/día.
 *
 * `Cart.expiresAt` se setea a 30 días desde la creación / último update.
 * Carritos cuyo `expiresAt` ya pasó están muertos: el guest ya volvió, o
 * abandonó, o nunca volverá. Borrarlos en cascada elimina sus `CartItem`s.
 *
 * Sin este cron, la tabla `Cart` crece sin tope — bloating el DB y haciendo
 * más lentos los `findFirst` por guestToken.
 *
 * Auth: mismo header `Authorization: Bearer <CRON_SECRET>` que `/billing`.
 * Lock: no necesario — la operación es idempotente (un delete sobre rows
 * ya vencidos no afecta nada nuevo si se corre 2× seguido).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET_MIN_LENGTH = 32;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV === "development" && !process.env.CI;
  }
  if (expected.length < CRON_SECRET_MIN_LENGTH) {
    console.error(
      `[cron:cleanup-carts] CRON_SECRET too short (${expected.length} chars, min ${CRON_SECRET_MIN_LENGTH}).`,
    );
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] ?? "";
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  // `deleteMany` con cascade vía Prisma: el schema declara `onDelete: Cascade`
  // de CartItem.cart, así que los items se borran junto al cart padre.
  //
  // Envolvemos en try/catch para que un error transitorio de DB (timeout,
  // connection refused) devuelva un 500 estructurado y quede visible en
  // Sentry, en vez de explotar como 500 genérico del Next runtime que se
  // pierde sin contexto. El cron de Vercel reintenta automáticamente al
  // día siguiente, así que un fallo aislado no es crítico.
  try {
    const result = await db.cart.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const payload = {
      ranAt: now.toISOString(),
      cartsDeleted: result.count,
    };
    console.log("[cleanup-carts-cron]", JSON.stringify(payload));
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cleanup-carts-cron] failed", { message });
    return NextResponse.json(
      { error: "cleanup_failed", ranAt: now.toISOString(), message },
      { status: 500 },
    );
  }
}

// Vercel Cron solo dispara GET; no exportamos POST para no abrir una
// superficie extra de invocación cross-site sin Origin check.
