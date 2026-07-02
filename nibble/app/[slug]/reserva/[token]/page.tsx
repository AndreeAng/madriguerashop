import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Check, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontData } from "@/lib/tenant/resolve";
import { toStoreView } from "@/lib/storefront/adapter";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { formatWaPhone } from "@/lib/utils";
import { trackPageView } from "@/lib/analytics/track";

export const metadata = {
  title: "Reserva confirmada",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<
  "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
  { label: string; description: string; tone: "amber" | "leaf" | "tomato" | "muted" }
> = {
  PENDING: {
    label: "Pendiente de confirmación",
    description:
      "Recibimos tu solicitud. El local va a confirmarla por WhatsApp en breve.",
    tone: "amber",
  },
  CONFIRMED: {
    label: "Confirmada",
    description: "El local confirmó tu reserva. ¡Te esperamos!",
    tone: "leaf",
  },
  CANCELLED: {
    label: "Cancelada",
    description: "Esta reserva fue cancelada. Si fue por error, contacta al local.",
    tone: "tomato",
  },
  COMPLETED: {
    label: "Completada",
    description: "¡Gracias por venir! Esperamos verte pronto.",
    tone: "muted",
  },
  NO_SHOW: {
    label: "No asistió",
    description: "Este turno quedó marcado como no asistido.",
    tone: "tomato",
  },
};

import { longDate } from "@/lib/i18n/dates";
import { inBolivia } from "@/lib/booking/timezone";

// `formatDateLong` y `formatHHMM` antes vivían como copias locales — ahora
// reusamos `longDate` del módulo compartido y un wrapper trivial para hora.
const formatDateLong = (d: Date) => longDate(d);
// Hora en zona Bolivia (UTC-4). `d.getHours()` usa la TZ del proceso, que en
// Vercel es UTC: una reserva a las "10:00 BOT" se mostraría como "14:00".
function formatHHMM(d: Date): string {
  const b = inBolivia(d);
  return `${String(b.hours).padStart(2, "0")}:${String(b.minutes).padStart(2, "0")}`;
}

export default async function ReservaPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const [booking, storeData] = await Promise.all([
    db.booking.findUnique({
      where: { trackingToken: token },
      include: {
        product: { select: { name: true } },
        store: { select: { slug: true, name: true, whatsappPhone: true } },
      },
    }),
    getStorefrontData(slug).catch(() => null),
  ]);

  if (!booking || booking.store.slug !== slug || !storeData) notFound();

  void trackPageView({ storeId: booking.storeId, path: `/${slug}/reserva/${token}` });

  const store = toStoreView(storeData, { hours: storeData.storeHours });
  const status = STATUS_COPY[booking.status];
  const phoneOnly = formatWaPhone(booking.store.whatsappPhone);

  const toneCls =
    status.tone === "leaf"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : status.tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : status.tone === "tomato"
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-[color:var(--line)] bg-[color:var(--bg)] text-[color:var(--muted)]";

  return (
    <div>
      <StorefrontHeader store={store} cartCount={0} />

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div
          className={`flex items-start gap-3 rounded-3xl border p-5 ${toneCls}`}
        >
          <Check className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-widest">{status.label}</p>
            <h1 className="font-display mt-1 text-2xl leading-tight">
              {booking.status === "PENDING"
                ? `Reserva guardada — ${booking.product.name}`
                : `${booking.product.name}`}
            </h1>
            <p className="mt-2 text-sm">{status.description}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
          <Row
            icon={<Calendar className="size-4" />}
            label="Día"
            value={formatDateLong(new Date(booking.startsAt))}
          />
          <Row
            icon={<Clock className="size-4" />}
            label="Hora"
            value={`${formatHHMM(new Date(booking.startsAt))} – ${formatHHMM(
              new Date(booking.endsAt),
            )}`}
          />
          <Row
            icon={<MapPin className="size-4" />}
            label="Local"
            value={booking.store.name}
          />
          {booking.notes && (
            <Row
              icon={<MessageCircle className="size-4" />}
              label="Tus notas"
              value={booking.notes}
            />
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
          <p className="text-sm font-semibold">¿Necesitas cambiar algo?</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Escríbenos por WhatsApp y te ayudamos a reagendar o cancelar.
          </p>
          <Link
            href={`https://wa.me/${phoneOnly}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white"
          >
            <Phone className="size-4" />
            WhatsApp del local
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--muted)]">
          Guarda este link para volver a ver tu reserva más tarde.
        </p>
      </main>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--bg)] text-[color:var(--muted)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">
          {label}
        </p>
        <p className="mt-0.5 font-medium">{value}</p>
      </div>
    </div>
  );
}
