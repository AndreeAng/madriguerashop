import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NibbleLogo } from "@/components/shared/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Acceder · Nibble",
};

export default async function LoginPage() {
  // Si ya está autenticado, redirigir según rol
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "SUPER_ADMIN") redirect("/admin");
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-12">
        <Link href="/">
          <NibbleLogo />
        </Link>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-4xl">Bienvenido de vuelta</h1>
          <p className="mt-2 text-[color:var(--muted)]">
            Ingresa con tu email o teléfono para gestionar tu tienda.
          </p>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-[color:var(--muted)]">
            ¿No tienes cuenta?{" "}
            <Link href="/#precio" className="font-medium text-[color:var(--fg)] hover:underline">
              Crear una tienda
            </Link>
          </p>
        </div>

        <p className="text-xs text-[color:var(--muted)]">© 2026 Nibble · Cochabamba, Bolivia</p>
      </div>

      <div className="relative hidden overflow-hidden bg-[color:var(--color-bark-900)] lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(245,158,11,0.35), transparent 35%), radial-gradient(circle at 80% 70%, rgba(217,119,6,0.25), transparent 35%)",
          }}
        />
        <div className="relative flex h-full flex-col items-start justify-end p-12 text-white">
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-300)]">
            Tienda de muestra
          </p>
          <h2 className="font-display mt-3 text-4xl leading-tight">
            "Migramos a Nibble en una tarde. Las ventas subieron 40% el primer mes solo por el mapa de calor."
          </h2>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[color:var(--color-amber-500)] text-sm font-bold">
              DA
            </div>
            <div>
              <p className="text-sm font-semibold">Diego Antezana</p>
              <p className="text-xs text-white/70">Big Bite Wings · Cochabamba</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
