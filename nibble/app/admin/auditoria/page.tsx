import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "Auditoría · Admin" };

const ACTION_LABELS: Record<string, string> = {
  "auth.login.success": "Login exitoso",
  "auth.login.failed": "Login fallido",
  "auth.logout": "Logout",
  "auth.password_reset.requested": "Reset solicitado",
  "auth.password_reset.completed": "Reset completado",
  "store.registered": "Tienda registrada",
  "order.created": "Pedido creado",
  "order.status_changed": "Estado cambiado",
  "order.payment.verified": "Pago verificado",
  "order.payment.rejected": "Pago rechazado",
  "invoice.generated": "Factura generada",
  "invoice.proof_uploaded": "Comprobante subido",
  "invoice.payment.verified": "Pago factura verificado",
  "invoice.cancelled": "Factura cancelada",
  "store.suspended": "Tienda suspendida",
  "store.reactivated": "Tienda reactivada",
  "banner.created": "Banner creado",
  "banner.updated": "Banner editado",
  "banner.deleted": "Banner eliminado",
  "popup.created": "Popup creado",
  "popup.updated": "Popup editado",
  "popup.deleted": "Popup eliminado",
  "coupon.created": "Cupón creado",
  "coupon.updated": "Cupón editado",
  "coupon.deleted": "Cupón eliminado",
  "delivery_zone.created": "Zona creada",
  "delivery_zone.updated": "Zona editada",
  "delivery_zone.deleted": "Zona eliminada",
  "booking_block.created": "Bloqueo creado",
  "booking_block.deleted": "Bloqueo eliminado",
  "saas.store_impersonation_started": "Admin entró como tienda",
  "saas.store_impersonation_ended": "Admin salió del modo tienda",
};

const FILTER_TABS: { key: string; label: string; matches: (a: string) => boolean }[] = [
  { key: "all", label: "Todos", matches: () => true },
  { key: "auth", label: "Auth", matches: (a) => a.startsWith("auth.") },
  { key: "store", label: "Tiendas", matches: (a) => a.startsWith("store.") },
  { key: "order", label: "Pedidos", matches: (a) => a.startsWith("order.") },
  { key: "invoice", label: "Facturas", matches: (a) => a.startsWith("invoice.") },
  {
    key: "marketing",
    label: "Marketing",
    matches: (a) =>
      a.startsWith("banner.") || a.startsWith("popup.") || a.startsWith("coupon."),
  },
  {
    key: "delivery",
    label: "Delivery",
    matches: (a) => a.startsWith("delivery_zone."),
  },
  {
    key: "reservas",
    label: "Reservas",
    matches: (a) => a.startsWith("booking_block."),
  },
];

function actionToneClass(action: string): string {
  if (action.includes("failed") || action.includes("rejected") || action.includes("cancelled") || action.includes("suspended")) {
    return "bg-red-100 text-red-700";
  }
  if (action.includes("verified") || action.includes("completed") || action.includes("registered") || action.includes("created")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (action.includes("requested") || action.includes("uploaded") || action.includes("generated")) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-blue-100 text-blue-700";
}

const PAGE_SIZE = 100;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const filter = sp.filter ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);

  // Filtrado en DB — algunos tabs cubren varios prefijos (Marketing =
  // banners + popups + cupones), por eso usamos un mapa a arrays y
  // construimos un OR si hay más de uno. Antes los nuevos tabs caían en
  // la rama `null` y se traía la tabla entera, ignorando el filtro.
  const FILTER_PREFIXES: Record<string, string[]> = {
    auth: ["auth."],
    store: ["store."],
    order: ["order."],
    invoice: ["invoice."],
    marketing: ["banner.", "popup.", "coupon."],
    delivery: ["delivery_zone."],
    reservas: ["booking_block."],
  };
  const prefixes = FILTER_PREFIXES[filter];
  const where: { OR?: { action: { startsWith: string } }[] } = prefixes
    ? prefixes.length === 1
      ? { OR: [{ action: { startsWith: prefixes[0]! } }] }
      : { OR: prefixes.map((p) => ({ action: { startsWith: p } })) }
    : {};

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  // Resolver actores (nombres)
  const actorIds = Array.from(
    new Set(entries.map((e) => e.actorId).filter((id): id is string => Boolean(id))),
  );
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true, username: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/auditoria${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
        {/* Búsqueda removida: el input antes era decorativo (no estaba dentro
            de un form, no se leía `q` desde searchParams). Volverá cuando
            el filtro por texto se implemente server-side. */}

        <main className="p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Trazabilidad
            </p>
            <h1 className="font-display mt-1 text-3xl">Auditoría</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Últimos 200 eventos · {entries.length} en el filtro actual
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {FILTER_TABS.map((t) => {
              const isActive = filter === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/admin/auditoria?filter=${t.key}`}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    isActive
                      ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                      : "border-[color:var(--line)] bg-[color:var(--card)] text-[color:var(--fg-soft)] hover:border-[color:var(--color-bark-300)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 overflow-x-auto rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
            {entries.length === 0 ? (
              <div className="p-10 text-center">
                <ShieldCheck className="mx-auto size-8 text-[color:var(--muted)]" />
                <p className="mt-3 text-[color:var(--muted)]">
                  No hay eventos registrados todavía.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--bg)] text-xs uppercase text-[color:var(--muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left font-medium">Cuándo</th>
                    <th scope="col" className="px-3 py-3 text-left font-medium">Acción</th>
                    <th scope="col" className="hidden px-3 py-3 text-left font-medium md:table-cell">
                      Actor
                    </th>
                    <th scope="col" className="hidden px-3 py-3 text-left font-medium lg:table-cell">
                      Target
                    </th>
                    <th scope="col" className="hidden px-3 py-3 text-left font-medium lg:table-cell">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {entries.map((e) => {
                    const actor = e.actorId
                      ? actorMap.get(e.actorId)
                      : null;
                    const label = ACTION_LABELS[e.action] ?? e.action;
                    return (
                      <tr key={e.id}>
                        <td className="px-5 py-3 text-xs text-[color:var(--muted)]">
                          {e.createdAt.toLocaleString("es-BO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${actionToneClass(
                              e.action,
                            )}`}
                          >
                            {label}
                          </span>
                          <p className="mt-0.5 font-mono text-[10px] text-[color:var(--muted)]">
                            {e.action}
                          </p>
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          {actor ? (
                            <span>
                              <span className="block">
                                {actor.fullName ?? actor.username}
                              </span>
                              <span className="text-[10px] font-mono text-[color:var(--muted)]">
                                {e.actorRole ?? ""}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[color:var(--muted)]">
                              {e.actorRole ?? "anónimo"}
                            </span>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 lg:table-cell">
                          <span className="font-mono text-xs text-[color:var(--muted)]">
                            {e.target ?? "—"}
                          </span>
                        </td>
                        <td className="hidden px-3 py-3 lg:table-cell">
                          <span className="font-mono text-xs text-[color:var(--muted)]">
                            {e.ip ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="evento"
            buildPageHref={buildPageHref}
          />
        </main>
    </>
  );
}
