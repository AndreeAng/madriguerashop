/**
 * Script one-shot para probar el importer de Quick contra Leozma.
 * Corre con: `npx tsx scripts/test-quick-import.ts`
 *
 * Lee env vars del proceso (DATABASE_URL, OWNER_PASSWORD, OWNER_PHONE,
 * OWNER_IDENTIFIER) — asegúrate de tener .env cargado o exportarlas antes.
 *
 * Guardrail: aborta si NODE_ENV es production o si DATABASE_URL apunta a
 * un host de Neon/Supabase/Vercel principal — este script borra y recrea
 * datos, nunca debe correr contra producción.
 */
import { db } from "../lib/db";
import { importQuickStore } from "../lib/import/quick/importer";
import { hashPassword } from "../lib/auth/password";

function assertNotProduction() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ ABORT: NODE_ENV=production. Este script borra datos.");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL ?? "";
  if (/\b(prod|main)\b/i.test(url)) {
    console.error(
      "❌ ABORT: DATABASE_URL contiene 'prod' o 'main'. Apunta a una branch de DB de prueba.",
    );
    process.exit(1);
  }
}

async function main() {
  assertNotProduction();

  const ownerPassword = process.env.OWNER_PASSWORD;
  const ownerPhone = process.env.OWNER_PHONE ?? "+59100000000";
  const ownerIdentifier =
    process.env.OWNER_IDENTIFIER ?? "leozma-owner@madrigueras.shop";

  if (!ownerPassword) {
    console.error(
      "❌ Falta OWNER_PASSWORD en env. Exporta una contraseña antes de correr el script.",
    );
    process.exit(1);
  }

  console.log("== Quick importer smoke test == ");

  // Si ya existe leozma, borramos para reintentar limpio
  const existing = await db.store.findUnique({
    where: { slug: "leozma" },
    select: { id: true },
  });
  if (existing) {
    console.log(`⚠ Tienda 'leozma' ya existe (id=${existing.id}). Borrando para reintentar limpio…`);
    // Borrar User asociado primero (FK)
    await db.user.deleteMany({ where: { storeId: existing.id } });
    await db.store.delete({ where: { id: existing.id } });
    console.log("✓ Borrada.");
  }

  // También borrar el user por username si quedó huérfano de un intento previo
  const orphan = await db.user.findUnique({
    where: { username: ownerIdentifier },
    select: { id: true },
  });
  if (orphan) {
    await db.user.delete({ where: { id: orphan.id } });
    console.log("✓ User huérfano del intento anterior borrado.");
  }

  const t0 = Date.now();
  const ownerPasswordHash = await hashPassword(ownerPassword);
  const result = await importQuickStore({
    sourceSlug: "leozma",
    target: {
      slug: "leozma",
      storeName: "Leozma",
      vertical: "RETAIL",
      city: "Cochabamba",
      whatsappPhone: ownerPhone,
      ownerName: "Owner Leozma",
      ownerIdentifier,
      ownerPasswordHash,
    },
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n== Resultado ==");
  console.log(`Store ID:        ${result.storeId}`);
  console.log(`Slug:            ${result.storeSlug}`);
  console.log(`Categorías:      ${result.categoriesCreated}`);
  console.log(`Productos:       ${result.productsCreated}`);
  console.log(`Imágenes OK:     ${result.imagesDownloaded}`);
  console.log(`Warnings:        ${result.warnings.length}`);
  console.log(`Tiempo:          ${elapsed}s`);

  if (result.warnings.length > 0) {
    console.log("\n== Warnings ==");
    for (const w of result.warnings) console.log(`  · ${w}`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
