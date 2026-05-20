import { db } from "../lib/db";

async function main() {
  const store = await db.store.findUnique({
    where: { slug: "leozma" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      logoUrl: true,
      faviconUrl: true,
      bannerUrl: true,
      description: true,
      _count: { select: { products: true, categories: true } },
    },
  });
  console.log("Store:", JSON.stringify(store, null, 2));
  if (!store) {
    await db.$disconnect();
    return;
  }

  const cats = await db.category.findMany({
    where: { storeId: store.id },
    orderBy: { sortOrder: "asc" },
    select: {
      name: true,
      slug: true,
      sortOrder: true,
      _count: { select: { products: true } },
    },
  });
  console.log("\nCategorías:");
  for (const c of cats)
    console.log(`  ${c.sortOrder}. ${c.name} (${c.slug}) — ${c._count.products} productos`);

  const sample = await db.product.findMany({
    where: { storeId: store.id },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      slug: true,
      basePrice: true,
      category: { select: { name: true } },
      images: { take: 1, select: { url: true } },
    },
  });
  console.log("\nMuestra de productos (8 últimos):");
  for (const p of sample) {
    console.log(
      `  - ${p.name} (${p.slug}): Bs ${p.basePrice} · cat=${p.category?.name ?? "—"} · img=${p.images[0]?.url ?? "sin"}`,
    );
  }

  const owner = await db.user.findFirst({
    where: { storeId: store.id, role: "STORE_OWNER" },
    select: { username: true, email: true, fullName: true },
  });
  // Redactamos email/username para evitar dumpear PII a stdout — si este
  // script corre en CI con logging centralizado, el email completo queda
  // en los logs indefinidamente.
  const redact = (s: string | null | undefined): string | null => {
    if (!s) return null;
    if (s.includes("@")) {
      const [local, domain] = s.split("@");
      return `${local?.[0] ?? ""}***@${domain ?? ""}`;
    }
    return `***${s.slice(-4)}`;
  };
  console.log("\nOwner:", {
    username: redact(owner?.username),
    email: redact(owner?.email ?? null),
    fullName: owner?.fullName,
  });

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
