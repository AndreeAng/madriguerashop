import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { requireStoreOwner } from "@/lib/auth/session";
import { readImpersonatedStoreId } from "@/lib/auth/impersonation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

/**
 * Layout compartido del dashboard del merchant. Antes cada page repetía
 * el wrapper `<div className="flex min-h-screen">` + `<DashboardSidebar>`
 * con la misma store prop. Ahora vive acá una sola vez.
 *
 * El `requireStoreOwner()` redirige a /login o /registro según corresponda
 * antes de renderizar; las pages hijas pueden volver a llamarlo (la query
 * está cacheada por request vía React `cache`).
 *
 * Si el caller es SUPER_ADMIN con cookie de impersonation, ese guard ya
 * devolvió la tienda impersonada — acá detectamos el caso por la cookie
 * para pintar el banner amarillo arriba del layout y dejar claro al admin
 * en qué tienda está editando.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { store, user } = await requireStoreOwner();
  const impersonatedId = await readImpersonatedStoreId();
  const isImpersonating =
    user.role === Role.SUPER_ADMIN && impersonatedId === store.id;

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar
        store={{
          name: store.name,
          slug: store.slug,
          primaryColor: store.primaryColor,
          logoUrl: store.logoUrl,
        }}
        // `requireStoreOwner` ya garantiza que role ∈ {STORE_OWNER, CASHIER,
        // SUPER_ADMIN} (cualquier otra cosa redirige). El tipo crudo es
        // `string` porque el shape del session viene de NextAuth; el cast
        // sólo refleja el invariante que la función ya validó.
        userRole={user.role as "STORE_OWNER" | "CASHIER" | "SUPER_ADMIN"}
      />
      <div className="flex-1">
        {isImpersonating && (
          <ImpersonationBanner storeName={store.name} />
        )}
        {children}
      </div>
    </div>
  );
}
