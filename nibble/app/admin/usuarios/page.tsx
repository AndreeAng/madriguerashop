import Link from "next/link";
import { Search, Users, ShieldOff, ShieldCheck, Mail } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma, Role } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth/session";
import { UserActions } from "@/components/admin/usuarios/UserActions";
import { Pagination } from "@/components/ui/Pagination";
import { FilterTabs } from "@/components/ui/FilterTabs";

export const metadata = { title: "Usuarios · Admin" };

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  STORE_OWNER: "Dueño",
  CASHIER: "Cajero",
  CUSTOMER: "Cliente",
};

const ROLE_TONE: Record<Role, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700",
  STORE_OWNER: "bg-amber-100 text-amber-700",
  CASHIER: "bg-blue-100 text-blue-700",
  CUSTOMER: "bg-slate-100 text-slate-700",
};

const PAGE_SIZE = 50;

const ROLES: Role[] = ["SUPER_ADMIN", "STORE_OWNER", "CASHIER", "CUSTOMER"];

function parseRole(input: unknown): Role | null {
  return typeof input === "string" && (ROLES as string[]).includes(input)
    ? (input as Role)
    : null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const roleFilter = sp.role === "all" ? null : parseRole(sp.role);
  const statusFilter =
    sp.status === "active" || sp.status === "suspended" ? sp.status : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" as const } },
            { fullName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(statusFilter === "active" ? { isActive: true } : {}),
    ...(statusFilter === "suspended" ? { isActive: false } : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        store: { select: { slug: true, name: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (page > 1) params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === "all" || v === 1) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return `/admin/usuarios${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-6">
            <form action="/admin/usuarios" className="relative w-80 max-w-full">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre, email, username o teléfono"
                className="w-full rounded-full border border-[color:var(--line)] bg-[color:var(--card)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--color-bark-300)]"
              />
              {roleFilter && <input type="hidden" name="role" value={roleFilter} />}
              {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
            </form>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-500)]">
              Plataforma
            </p>
            <h1 className="font-display mt-1 text-3xl">Usuarios</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {total} {total === 1 ? "usuario" : "usuarios"}
              {q || roleFilter || statusFilter !== "all" ? " (filtrados)" : ""} ·
              página {page} de {totalPages}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <FilterTabs
              activeKey={roleFilter ?? ""}
              items={[
                {
                  key: "",
                  label: "Todos los roles",
                  href: buildHref({ role: undefined, page: undefined }),
                },
                ...ROLES.map((r) => ({
                  key: r,
                  label: ROLE_LABELS[r],
                  href: buildHref({ role: r, page: undefined }),
                })),
              ]}
            />
            <span className="mx-2 self-center text-[color:var(--muted)]">·</span>
            <FilterTabs
              activeKey={statusFilter}
              items={[
                {
                  key: "all",
                  label: "Todos",
                  href: buildHref({ status: undefined, page: undefined }),
                },
                {
                  key: "active",
                  label: "Activos",
                  href: buildHref({ status: "active", page: undefined }),
                },
                {
                  key: "suspended",
                  label: "Suspendidos",
                  href: buildHref({ status: "suspended", page: undefined }),
                },
              ]}
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
            {users.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="mx-auto size-8 text-[color:var(--muted)]" />
                <p className="mt-3 text-[color:var(--muted)]">
                  {q ? "No se encontraron usuarios con esa búsqueda." : "No hay usuarios."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--bg)] text-xs uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Usuario</th>
                    <th className="hidden px-3 py-3 text-left font-medium md:table-cell">Tienda</th>
                    <th className="px-3 py-3 text-left font-medium">Rol</th>
                    <th className="hidden px-3 py-3 text-left font-medium lg:table-cell">Último login</th>
                    <th className="px-3 py-3 text-left font-medium">Estado</th>
                    <th className="px-3 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {users.map((u) => {
                    const isSelf = u.id === admin.userId;
                    return (
                      <tr key={u.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium">{u.fullName ?? u.username}</p>
                          <p className="text-xs text-[color:var(--muted)]">
                            {u.email ?? u.username}
                          </p>
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          {u.store ? (
                            <Link
                              href={`/${u.store.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[color:var(--fg)] underline decoration-[color:var(--line)] underline-offset-4 hover:decoration-[color:var(--color-amber-400)]"
                            >
                              {u.store.name}
                            </Link>
                          ) : (
                            <span className="text-xs text-[color:var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_TONE[u.role]}`}
                          >
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="hidden px-3 py-3 text-xs text-[color:var(--muted)] lg:table-cell">
                          {u.lastLoginAt
                            ? u.lastLoginAt.toLocaleDateString("es-BO", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "Nunca"}
                        </td>
                        <td className="px-3 py-3">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-leaf-600)]">
                              <ShieldCheck className="size-3.5" /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-tomato-600)]">
                              <ShieldOff className="size-3.5" /> Suspendido
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <UserActions
                            user={{
                              id: u.id,
                              role: u.role,
                              isActive: u.isActive,
                              hasEmail: Boolean(u.email),
                              hasStore: Boolean(u.store),
                            }}
                            isSelf={isSelf}
                          />
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
            itemLabel="usuario"
            buildPageHref={(p) => buildHref({ page: p })}
          />

          <div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 text-xs text-[color:var(--muted)]">
            <p className="flex items-center gap-2">
              <Mail className="size-4" />
              Reset de password manda el email del flow de recovery normal — el
              link expira en 1 hora.
            </p>
          </div>
        </main>
    </>
  );
}

