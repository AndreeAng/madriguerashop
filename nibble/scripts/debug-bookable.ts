import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const stores = await db.store.findMany({
    where: { slug: { in: ["estudio-clara", "estudio-bella"] } },
    include: {
      products: {
        select: {
          slug: true,
          name: true,
          isBookable: true,
          bookingDurationMin: true,
          isActive: true,
        },
        orderBy: { slug: "asc" },
      },
      storeHours: { orderBy: { dayOfWeek: "asc" } },
    },
  });
  for (const s of stores) {
    console.log("\n=== STORE:", s.slug, "===");
    console.log("Hours:");
    for (const h of s.storeHours) {
      console.log(
        `  dow=${h.dayOfWeek} ${h.isClosed ? "CERRADO" : `${h.openTime}-${h.closeTime}`}`,
      );
    }
    console.log("Products:");
    for (const p of s.products) {
      console.log(
        `  ${p.slug}: isBookable=${p.isBookable} duration=${p.bookingDurationMin} active=${p.isActive}`,
      );
    }
  }
  await db.$disconnect();
}
main();
