// Limpia las tiendas de test (kiosko-test-*) y sus owners de la DB LOCAL.
// Mismo orden de borrado que adminDeleteStoreAction: primero las tablas
// con FK Restrict (orders, invoices, counter), luego el store (cascade).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const stores = await db.store.findMany({
  where: { slug: { startsWith: "kiosko-test-" } },
  select: { id: true, slug: true },
});

for (const s of stores) {
  await db.order.deleteMany({ where: { storeId: s.id } });
  await db.invoice.deleteMany({ where: { storeId: s.id } });
  await db.storeOrderCounter.deleteMany({ where: { storeId: s.id } });
  await db.store.delete({ where: { id: s.id } });
  console.log(`eliminada: ${s.slug}`);
}

// Los owners de test quedaron con storeId=null (SetNull) — fuera también.
const users = await db.user.deleteMany({
  where: { username: { startsWith: "owner.test." } },
});
console.log(`tiendas eliminadas: ${stores.length} · owners de test: ${users.count}`);
await db.$disconnect();
