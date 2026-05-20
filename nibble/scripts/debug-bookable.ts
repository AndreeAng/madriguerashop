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
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    // Garantiza que el pool de Prisma se cierre — sin esto, una excepción
    // antes del `$disconnect` deja el proceso colgado por las conexiones
    // abiertas (mata el feedback loop del dev cuando algo falla).
    // El `await` (no `void`) hace que el proceso espere efectivamente al
    // cierre — `void` programa la promesa pero el event loop puede
    // terminar antes de procesarla.
    await db.$disconnect();
  });
