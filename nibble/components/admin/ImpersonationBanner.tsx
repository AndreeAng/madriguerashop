import { ShieldAlert } from "lucide-react";
import { adminExitStoreAction } from "@/server/actions/admin-stores";

/**
 * Banner sticky que aparece arriba del dashboard cuando un SUPER_ADMIN
 * está actuando como shadow owner de una tienda. Es VISIBLE Y CONSTANTE
 * para que el admin nunca olvide que está editando una tienda ajena —
 * cargar 50 productos en la demo equivocada porque "creía que era la
 * suya" es la falla que este banner previene.
 */
export function ImpersonationBanner({ storeName }: { storeName: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[color:var(--color-amber-500)] px-4 py-2.5 text-sm text-[color:var(--color-bark-900)] shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" />
        <p>
          <span className="font-semibold">Modo configuración:</span> estás
          editando{" "}
          <strong className="font-semibold">{storeName}</strong> como admin.
          Cualquier cambio queda guardado en esa tienda.
        </p>
      </div>
      <form action={adminExitStoreAction}>
        <button
          type="submit"
          className="rounded-full bg-[color:var(--color-bark-900)] px-3 py-1 text-xs font-medium text-white transition hover:bg-black"
        >
          Salir del modo admin
        </button>
      </form>
    </div>
  );
}
