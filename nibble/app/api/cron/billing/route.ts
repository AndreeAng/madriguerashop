import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runBillingCycle } from "@/lib/billing/runBillingCycle";
import { syncStoreStatuses } from "@/lib/billing/syncStoreStatuses";
import { sendInvoiceReminders } from "@/lib/billing/sendReminders";
import { runAlertDetection } from "@/lib/alerts/detection";
import { db } from "@/lib/db";

/**
 * Cron de billing — corre 1×/día.
 *
 * Tareas:
 *  1. Emitir invoices para tiendas con nextInvoiceAt <= now
 *  2. Marcar PENDING vencidas como OVERDUE
 *  3. Tiendas con OVERDUE → PAST_DUE; con OVERDUE+grace → SUSPENDED
 *  4. Reactivar tiendas que pagaron
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>` con compare timing-safe.
 *
 * Lock: usa la tabla CronRun. Si ya hay un run `RUNNING` con menos de
 * 10 minutos, este trigger se descarta — evita doble emisión cuando
 * el provider (Vercel/Cloudflare) reintenta tras timeout.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

const CRON_NAME = "billing";
// Stale cutoff acotado al maxDuration: si el run no respondió en N min, lo
// consideramos muerto. Margen: maxDuration es 5min → cutoff a 6min permite
// runs largos sin falsos positivos pero sin abrir ventana de doble emisión.
const STALE_LOCK_MINUTES = 6;

const CRON_SECRET_MIN_LENGTH = 32;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Sin secret: solo permitimos en dev local (NO en staging ni CI). Staging
    // suele correr con NODE_ENV=production igual que prod, así que el check
    // anterior (`!== "production"`) dejaba staging desprotegido.
    return process.env.NODE_ENV === "development" && !process.env.CI;
  }
  // Validamos entropía mínima: un secret de pocos caracteres (`abc`, `test`)
  // pasa todos los demás checks pero es brutalmente bruteforceable. Lo
  // logueamos como error de configuración y rechazamos para que el operador
  // se entere antes de que un atacante.
  if (expected.length < CRON_SECRET_MIN_LENGTH) {
    console.error(
      `[cron:billing] CRON_SECRET too short (${expected.length} chars, min ${CRON_SECRET_MIN_LENGTH}). Genera con: openssl rand -base64 32`,
    );
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] ?? "";
  // Hasheamos ambos a SHA-256 (32 bytes) para compare timing-safe sin filtrar
  // info del largo del token vía early return. Sin esto, distinguir
  // "demasiado corto/largo" de "largo correcto pero distinto" da timing oracle.
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_MINUTES * 60 * 1000);

  // Lock check: ¿hay un run reciente que no terminó?
  const inFlight = await db.cronRun.findFirst({
    where: {
      name: CRON_NAME,
      status: "RUNNING",
      startedAt: { gte: staleCutoff },
    },
    select: { id: true, startedAt: true },
  });
  if (inFlight) {
    return NextResponse.json(
      {
        skipped: true,
        reason: "another run in progress",
        otherRunStartedAt: inFlight.startedAt.toISOString(),
      },
      { status: 200 },
    );
  }

  // Cleanup de runs zombies: cualquier RUNNING más viejo que el cutoff se
  // marca FAILED para que el operador sepa que el server crasheó a mitad.
  // Sin esto, el row queda RUNNING para siempre y nunca aparece en la alerta
  // CRON_FAILED del detector.
  const stale = await db.cronRun.updateMany({
    where: { name: CRON_NAME, status: "RUNNING", startedAt: { lt: staleCutoff } },
    data: {
      status: "FAILED",
      finishedAt: now,
      error: `Marked stale after ${STALE_LOCK_MINUTES} min — presumed crashed`,
    },
  });
  if (stale.count > 0) {
    console.warn(`[billing-cron] marked ${stale.count} stale run(s) as FAILED`);
  }

  const run = await db.cronRun.create({
    data: { name: CRON_NAME, status: "RUNNING" },
    select: { id: true, startedAt: true },
  });

  try {
    const billing = await runBillingCycle({ now: run.startedAt });
    const sync = await syncStoreStatuses({ now: run.startedAt });
    const reminders = await sendInvoiceReminders({ now: run.startedAt });
    const alerts = await runAlertDetection({ now: run.startedAt });

    const result = {
      ranAt: run.startedAt.toISOString(),
      durationMs: Date.now() - run.startedAt.getTime(),
      billing,
      sync,
      reminders,
      alerts,
    };

    await db.cronRun.update({
      where: { id: run.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        result: result as object,
      },
    });

    console.log("[billing-cron]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.cronRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    console.error("[billing-cron] failed:", err);
    return NextResponse.json(
      { error: "Cron failed", message },
      { status: 500 },
    );
  }
}

// POST también permitido por convención
export const POST = GET;
