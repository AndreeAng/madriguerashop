/**
 * Script one-shot para probar el importer de Quick contra Leozma.
 * Corre con: `npx tsx scripts/test-quick-import.ts`
 *
 * Lee env vars del proceso (DATABASE_URL, etc) — asegurate de tener .env
 * cargado o de exportarlas antes.
 */
import { db } from "../lib/db";
import { importQuickStore } from "../lib/import/quick/importer";

async function main() {
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
    where: { username: "leozma-owner@madrigueras.shop" },
    select: { id: true },
  });
  if (orphan) {
    await db.user.delete({ where: { id: orphan.id } });
    console.log("✓ User huérfano del intento anterior borrado.");
  }

  const t0 = Date.now();
  const result = await importQuickStore({
    sourceSlug: "leozma",
    target: {
      slug: "leozma",
      storeName: "Leozma",
      vertical: "RETAIL",
      city: "Cochabamba",
      whatsappPhone: "+59176355469",
      ownerName: "Owner Leozma",
      ownerIdentifier: "leozma-owner@madrigueras.shop",
      ownerPassword: "Leozma2026!",
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
