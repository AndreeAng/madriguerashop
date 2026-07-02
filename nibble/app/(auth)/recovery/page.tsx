import Link from "next/link";
import { requireGuest } from "@/lib/auth/session";
import { NibbleLogo } from "@/components/shared/Logo";
import { RecoveryRequestForm } from "./RecoveryRequestForm";

export const metadata = {
  title: "Recuperar contraseña · Madriguera Shop",
};

export default async function RecoveryPage() {
  await requireGuest();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-12">
        <Link href="/">
          <NibbleLogo />
        </Link>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-4xl">Recuperar acceso</h1>
          <p className="mt-2 text-[color:var(--muted)]">
            Ingresa el email asociado a tu cuenta y te mandamos un link para
            crear una nueva contraseña.
          </p>

          <RecoveryRequestForm />
        </div>

        <p className="text-xs text-[color:var(--muted)]">© {new Date().getFullYear()} Madriguera Shop · Cochabamba, Bolivia</p>
      </div>

      <div className="relative hidden overflow-hidden bg-[color:var(--color-bark-900)] lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(245,158,11,0.35), transparent 35%), radial-gradient(circle at 80% 70%, rgba(217,119,6,0.25), transparent 35%)",
          }}
        />
      </div>
    </div>
  );
}
