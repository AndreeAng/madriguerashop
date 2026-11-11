import { Check } from "lucide-react";
import Link from "next/link";
import { requireGuest } from "@/lib/auth/session";
import { NibbleLogo } from "@/components/shared/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Acceder · Madriguera Shop",
};

export default async function LoginPage() {
  await requireGuest();

  return (
    <main id="main-content" className="grid min-h-screen lg:grid-cols-2">
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
            <Link href="/registro" className="font-medium text-[color:var(--fg)] hover:underline">
              Crear una tienda
            </Link>
          </p>
        </div>

        <p className="text-xs text-[color:var(--muted)]">© {new Date().getFullYear()} Madriguera Shop · Cochabamba, Bolivia</p>
      </div>

      <div className="relative hidden overflow-hidden bg-[color:var(--color-bark-900)] lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 75% 15%, rgba(212,20,90,0.38), transparent 45%)",
          }}
        />
        <div className="relative flex h-full flex-col items-start justify-end p-12 text-white">
          <h2 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight">
            Tus pedidos te esperan.
          </h2>
          <ul className="mt-8 space-y-3 text-white/85">
            {[
              "Pedidos por WhatsApp, con dirección y total",
              "Pagos por QR de tu banco, sin comisión por venta",
              "Panel en tiempo real para no perder ninguno",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <Check aria-hidden="true" className="size-5 shrink-0 text-[color:var(--color-amber-300)]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
