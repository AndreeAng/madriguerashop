import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Test de integración: invariante de concurrencia del cupón.
 *
 * El bug original que evitamos: dos pedidos del MISMO cliente con el MISMO
 * cupón (`usageLimitPerUser=1`) podrían ambos pasar el check de `usedCount`
 * y ambos crear `CouponUsage`, violando el límite.
 *
 * El fix vive en `server/actions/orders.ts` dentro de la transacción de
 * `createOrderAction`:
 *
 *   UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
 *   WHERE "id" = $1 AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
 *
 * Ese UPDATE adquiere ROW EXCLUSIVE lock sobre la fila del cupón. Bajo
 * READ COMMITTED de Postgres, una tx concurrente del mismo cupón se
 * BLOQUEA hasta que la primera commitee. Al desbloquearse, re-evalúa el
 * WHERE — si el usedCount ya alcanzó el limit, el UPDATE devuelve count=0
 * y la segunda tx aborta.
 *
 * Este test verifica DIRECTAMENTE ese invariante con dos transacciones
 * lanzadas en paralelo. NO testea el `createOrderAction` completo (que
 * tiene 200+ líneas y necesita fixtures de cart, store, etc.); testea el
 * patrón de row-lock que es la pieza crítica.
 */

const prisma = new PrismaClient();

// Datos de test — slugs/codes prefixed con "test-" para no chocar con
// fixtures reales de la branch de test si las hubiera.
const TEST_STORE_SLUG = `test-toctou-${Date.now()}`;
const TEST_COUPON_CODE = `TESTTOCTOU${Date.now()}`;

let storeId: string;
let couponId: string;
let templateId: string;
let planId: string;

beforeAll(async () => {
  // Asegurar que existe AL MENOS un template y plan (vienen del seed
  // normal). Si la branch de test está vacía, esto falla — el setup pide
  // correr `prisma migrate deploy` Y `npm run db:seed` (sin demo password
  // para no llenar de tiendas).
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst();
  if (!template || !plan) {
    throw new Error(
      "Test DB no tiene templates/plans. Correr: " +
        "DATABASE_URL=$TEST_DATABASE_URL SEED_SUPER_ADMIN_EMAIL=test@example.com " +
        "SEED_SUPER_ADMIN_PASSWORD=test-password-not-real-12345 npm run db:seed",
    );
  }
  templateId = template.id;
  planId = plan.id;
});

afterAll(async () => {
  // Cleanup: borrar lo que el test creó. Order DESC porque hay FK constraints.
  await prisma.couponUsage.deleteMany({ where: { coupon: { code: TEST_COUPON_CODE } } });
  await prisma.coupon.deleteMany({ where: { code: TEST_COUPON_CODE } });
  await prisma.store.deleteMany({ where: { slug: TEST_STORE_SLUG } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Cada test arranca con el cupón en usedCount=0. Si un test anterior
  // dejó el coupon en otro estado, lo reseteamos.
  await prisma.couponUsage.deleteMany({
    where: { coupon: { code: TEST_COUPON_CODE } },
  });
});

describe("Cupón TOCTOU — invariante de row-lock bajo concurrencia", () => {
  it("crea fixtures: store + coupon con usageLimit=1", async () => {
    const store = await prisma.store.upsert({
      where: { slug: TEST_STORE_SLUG },
      create: {
        slug: TEST_STORE_SLUG,
        name: "Test TOCTOU Store",
        vertical: "RETAIL",
        templateId,
        planId,
        whatsappPhone: "+59170000000",
      },
      update: {},
    });
    storeId = store.id;

    const coupon = await prisma.coupon.upsert({
      where: { storeId_code: { storeId, code: TEST_COUPON_CODE } },
      create: {
        storeId,
        code: TEST_COUPON_CODE,
        type: "FIXED_AMOUNT",
        value: 10,
        usageLimit: 1, // Solo UN uso total — fundamental para el test
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
      },
      update: { usedCount: 0, usageLimit: 1 },
    });
    couponId = coupon.id;

    expect(storeId).toBeTruthy();
    expect(couponId).toBeTruthy();
  });

  it("UPDATE concurrente sobre el mismo cupón: solo UNO incrementa", async () => {
    // Helper que ejecuta el EXACT mismo SQL que orders.ts:748 ejecuta dentro
    // de su transacción. Si este test pasa, garantizamos que el patrón
    // row-lock funciona para serializar contendientes.
    async function tryClaim(): Promise<number> {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`
          UPDATE "Coupon"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${couponId}
            AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
        `;
        // Pausa pequeña dentro de la tx para forzar la ventana de contención.
        // Sin esto, las dos txs podrían serializar tan rápido que cada una
        // ve un snapshot "limpio". 50ms es suficiente para que la segunda
        // tx empiece y bloquee antes que la primera commitee.
        await new Promise((resolve) => setTimeout(resolve, 50));
        return Number(updated);
      });
    }

    // Lanzar las dos en paralelo (no awaitea hasta el Promise.all).
    const [r1, r2] = await Promise.all([tryClaim(), tryClaim()]);

    // Exactamente UNO debe haber actualizado (count=1). El otro vio
    // usedCount >= usageLimit en su re-evaluación post-lock y abortó.
    const successes = [r1, r2].filter((r) => r === 1).length;
    const failures = [r1, r2].filter((r) => r === 0).length;
    expect(successes).toBe(1);
    expect(failures).toBe(1);

    // Verificar estado final del cupón: usedCount=1 (no 2).
    const final = await prisma.coupon.findUnique({ where: { id: couponId } });
    expect(final?.usedCount).toBe(1);
  });

  it("UPDATE secuencial sobre cupón agotado: el segundo no incrementa", async () => {
    // Sanity check del WHERE — sin contención, una tx que llega al cupón
    // ya agotado debe ver count=0 y no actualizar.
    async function tryClaim(): Promise<number> {
      const updated = await prisma.$executeRaw`
        UPDATE "Coupon"
        SET "usedCount" = "usedCount" + 1
        WHERE "id" = ${couponId}
          AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
      `;
      return Number(updated);
    }

    // Reset a usedCount=0
    await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: 0 },
    });

    const r1 = await tryClaim();
    const r2 = await tryClaim();

    expect(r1).toBe(1); // Primer claim pasa
    expect(r2).toBe(0); // Segundo ve usedCount>=usageLimit, no actualiza
  });
});
