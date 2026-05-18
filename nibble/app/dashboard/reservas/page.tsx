import Link from "next/link";
import { Calendar } from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BookingsWeek } from "@/components/dashboard/reservas/BookingsWeek";
import { BookingBlocksClient } from "@/components/dashboard/reservas/BookingBlocksClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { addDays, startOfWeekMonday } from "@/lib/i18n/dates";

export const metadata = { title: "Reservas · Madriguera Shop" };

function parseWeekOffset(raw: string | undefined): number {
  const n = parseInt(raw ?? "0", 10);
  return Number.isFinite(n) && n >= -52 && n <= 52 ? n : 0;
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { store } = await requireStoreOwner();
  const sp = await searchParams;
  const weekOffset = parseWeekOffset(sp.week);

  const now = new Date();
  const weekStart = addDays(startOfWeekMonday(now), weekOffset * 7);
  const weekEnd = addDays(weekStart, 7);

  const [bookings, activeBlocks] = await Promise.all([
    db.booking.findMany({
      where: {
        storeId: store.id,
        startsAt: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { startsAt: "asc" },
      include: {
        product: { select: { name: true, bookingDurationMin: true } },
      },
    }),
    // Bloqueos vigentes y futuros (no listamos los que ya pasaron — ruido).
    db.bookingBlock.findMany({
      where: {
        storeId: store.id,
        endsAt: { gte: now },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  // Conteo rápido por status para el header de la página.
  const counts = {
    pending: bookings.filter((b) => b.status === BookingStatus.PENDING).length,
    confirmed: bookings.filter((b) => b.status === BookingStatus.CONFIRMED).length,
    cancelled: bookings.filter((b) => b.status === BookingStatus.CANCELLED).length,
    completed: bookings.filter((b) => b.status === BookingStatus.COMPLETED).length,
  };

  // Para serializar al cliente — Date → ISO, sin Prisma classes.
  const serialized = bookings.map((b) => ({
    id: b.id,
    productName: b.product.name,
    durationMin: b.product.bookingDurationMin,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    customerEmail: b.customerEmail,
    notes: b.notes,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
  }));

  return (
    <>
      <DashboardHeader storeSlug={store.slug} />

      <main className="mx-auto max-w-6xl p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Agenda
            </p>
            <h1 className="font-display mt-1 text-3xl">Reservas</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Tus servicios reservables. Confirma o cancela las pendientes.
              Tip: marcá un producto como reservable en{" "}
              <Link
                href="/dashboard/productos"
                className="font-medium text-[color:var(--fg)] underline"
              >
                Productos
              </Link>{" "}
              para que aparezca acá.
            </p>
          </div>

          <div className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--card)] p-1">
            <Link
              href={`/dashboard/reservas?week=${weekOffset - 1}`}
              className="rounded-full px-3 py-1 text-xs font-medium text-[color:var(--fg-soft)] hover:bg-[color:var(--bg)]"
            >
              ← Semana
            </Link>
            <Link
              href="/dashboard/reservas"
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                weekOffset === 0
                  ? "bg-[color:var(--color-bark-900)] text-white"
                  : "text-[color:var(--fg-soft)] hover:bg-[color:var(--bg)]"
              }`}
            >
              Esta semana
            </Link>
            <Link
              href={`/dashboard/reservas?week=${weekOffset + 1}`}
              className="rounded-full px-3 py-1 text-xs font-medium text-[color:var(--fg-soft)] hover:bg-[color:var(--bg)]"
            >
              Semana →
            </Link>
          </div>
        </div>

        {/* Stat chips */}
        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatChip label="Pendientes" value={counts.pending} tone="amber" />
          <StatChip label="Confirmadas" value={counts.confirmed} tone="leaf" />
          <StatChip label="Completadas" value={counts.completed} tone="muted" />
          <StatChip label="Canceladas" value={counts.cancelled} tone="tomato" />
        </section>

        {bookings.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<Calendar className="size-8" />}
            description="No hay reservas para esta semana."
          />
        ) : (
          <div className="mt-6">
            <BookingsWeek weekStart={weekStart.toISOString()} bookings={serialized} />
          </div>
        )}

        {/* Bloqueos de disponibilidad: vacaciones, almuerzo, etc.
            Va al final porque es config — el día a día es el calendario
            de arriba, esto se toca ocasionalmente. */}
        <div className="mt-8">
          <BookingBlocksClient
            blocks={activeBlocks.map((b) => ({
              id: b.id,
              startsAt: b.startsAt.toISOString(),
              endsAt: b.endsAt.toISOString(),
              reason: b.reason,
            }))}
          />
        </div>
      </main>
    </>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "leaf" | "muted" | "tomato";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "leaf"
        ? "bg-emerald-100 text-emerald-700"
        : tone === "tomato"
          ? "bg-rose-100 text-rose-700"
          : "bg-[color:var(--bg)] text-[color:var(--muted)]";
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="num-tabular text-2xl font-semibold">{value}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
          {label.toLowerCase()}
        </span>
      </div>
    </div>
  );
}
