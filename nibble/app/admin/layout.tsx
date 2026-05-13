import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/Sidebar";

/**
 * Layout compartido del panel /admin. Antes cada page repetía:
 *   const admin = await requireSuperAdmin();
 *   return <div className="flex min-h-screen"><AdminSidebar user={...}/>...
 *
 * Ahora vive acá. Las pages hijas pueden volver a llamar `requireSuperAdmin()`
 * cuando necesiten el `admin` object (la query está cacheada por request con
 * React `cache`, así que es gratis).
 *
 * Si una page quiere ocultar la sidebar (ej. landing pública dentro de /admin),
 * tendría que vivir fuera de este segment — actualmente todas las pages de
 * /admin requieren super admin, así que no es relevante.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar user={{ fullName: admin.fullName, email: admin.email }} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
