import Link from "next/link";
import { Check } from "lucide-react";
import { requireGuest } from "@/lib/auth/session";
import { NibbleLogo } from "@/components/shared/Logo";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Crear tu tienda · Madriguera Shop",
  description:
    "Empieza a vender por WhatsApp con tu propia tienda. Setup en minutos.",
};

const PERKS = [
  "Tu URL propia: madrigueras.shop/tutienda",
  "Cobras por QR de tu banco — sin comisión",
  "Pedidos directo a WhatsApp con todo el detalle",
  "Diseño según tu rubro, no un template global",
];

export default async function RegisterPage() {
  await requireGuest();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-12">
        <Link href="/">
          <NibbleLogo />
        </Link>

        <div className="mx-auto w-full max-w-md py-10">
          <h1 className="font-display text-4xl leading-tight">
            Tu tienda en 5 minutos.
          </h1>
          <p className="mt-2 text-[color:var(--muted)]">
            Llena estos datos y empiezas a recibir pedidos hoy mismo.
          </p>

          <RegisterForm />

          <p className="mt-8 text-center text-sm text-[color:var(--muted)]">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-[color:var(--fg)] hover:underline"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>

        <p className="text-xs text-[color:var(--muted)]">
          © {new Date().getFullYear()} Madriguera Shop · Cochabamba, Bolivia
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-[color:var(--color-bark-900)] lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(245,158,11,0.35), transparent 35%), radial-gradient(circle at 80% 70%, rgba(217,119,6,0.25), transparent 35%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-amber-300)]">
            Sin tarjeta · Cancelas cuando quieras
          </p>

          <div>
            <h2 className="font-display text-4xl leading-tight">
              Lo que tienes desde el día 1
            </h2>
            <ul className="mt-8 space-y-4">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-base">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-amber-400)]/20 text-[color:var(--color-amber-300)]">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-white/90">{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-white/60">
            Plan Starter — Bs 500/mes. Cancelas cuando quieras.
          </p>
        </div>
      </div>
    </div>
  );
}
