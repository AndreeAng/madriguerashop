import { LogOut } from "lucide-react";
import { signOutAction } from "@/server/actions/auth-signout";

/**
 * Botón "Cerrar sesión" reutilizable para admin/dashboard sidebars.
 * Usa `<form action={serverAction}>` — el envío del form invoca la action,
 * que llama `signOut()` y redirige a `/login`. No requiere JS del cliente:
 * funciona incluso con JS deshabilitado.
 *
 * `variant` adapta el color para los dos temas de sidebar:
 *   - "dark": admin (sidebar oscuro) — texto blanco sutil.
 *   - "light": dashboard (sidebar claro) — texto fg-soft.
 */
export function SignOutButton({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const cls =
    variant === "dark"
      ? "text-white/70 hover:bg-white/5 hover:text-white"
      : "text-[color:var(--fg-soft)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]";

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${cls}`}
      >
        <LogOut className="size-4 shrink-0" />
        Cerrar sesión
      </button>
    </form>
  );
}
