import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { db } from "@/lib/db";
import { NibbleLogo } from "@/components/shared/Logo";
import { verifyEmailVerificationToken } from "@/lib/auth/email-verification-token";
import { audit } from "@/lib/audit/log";

export const metadata = {
  title: "Verificar email · Madriguera Shop",
};

/**
 * Verificación de email idempotente. Llamar varias veces con el mismo
 * token NO falla — solo no hace nada extra (ya está verificado).
 *
 * Diseño:
 *   - Hacemos el side effect (set emailVerifiedAt) en el render del page.
 *     Es una operación idempotente (`updateMany` con guard) y refleja
 *     correctamente la naturaleza del flow "click link → done".
 *   - Si el JWT es inválido, expirado o malformado: mostramos error con
 *     instrucciones para pedir uno nuevo.
 *   - No requerimos auth: el cliente que clickea desde su email puede no
 *     estar logueado en el browser. El token mismo es la credencial.
 */
export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const verify = verifyEmailVerificationToken(token);

  let status: "ok" | "already" | "expired" | "invalid";
  if (!verify.ok) {
    status = verify.reason === "expired" ? "expired" : "invalid";
  } else {
    // Idempotente: si emailVerifiedAt ya está seteado, no lo pisamos para
    // preservar el timestamp original (auditoría) y devolvemos "already".
    const updated = await db.user.updateMany({
      where: { id: verify.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    if (updated.count > 0) {
      await audit({
        action: "auth.password_reset.completed",
        // Reusamos esta action: no hay tipo dedicado para email-verified
        // todavía, y "completed" cubre el caso semánticamente (un flujo
        // de verificación se completó). TODO: agregar
        // `auth.email_verified` al enum cuando este flow tenga métricas
        // separadas.
        actorId: verify.userId,
        target: verify.userId,
        metadata: { flow: "email_verification" },
      });
      status = "ok";
    } else {
      // Ya estaba verificado, o el user no existe — distinguimos:
      const exists = await db.user.findUnique({
        where: { id: verify.userId },
        select: { id: true },
      });
      status = exists ? "already" : "invalid";
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link href="/" className="inline-block">
          <NibbleLogo />
        </Link>

        {status === "ok" && (
          <>
            <div className="grid size-12 mx-auto place-items-center rounded-full bg-[color:var(--color-leaf-500)]/15 text-[color:var(--color-leaf-600)]">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="font-display text-2xl">Email verificado</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Tu email quedó confirmado. Ya podés recibir notificaciones de
              pedidos y recordatorios de facturación.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <div className="grid size-12 mx-auto place-items-center rounded-full bg-[color:var(--color-amber-500)]/15 text-[color:var(--color-amber-600)]">
              <AlertCircle className="size-6" />
            </div>
            <h1 className="font-display text-2xl">Ya estaba verificado</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Este email ya fue confirmado antes. No hace falta hacer nada.
            </p>
          </>
        )}

        {(status === "expired" || status === "invalid") && (
          <>
            <div className="grid size-12 mx-auto place-items-center rounded-full bg-[color:var(--color-tomato-500)]/15 text-[color:var(--color-tomato-600)]">
              <XCircle className="size-6" />
            </div>
            <h1 className="font-display text-2xl">
              {status === "expired" ? "Link expirado" : "Link inválido"}
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              {status === "expired"
                ? "Este link de verificación expiró (24 hs)."
                : "Este link no es válido o ya fue procesado."}
              {" "}Pedí un nuevo link desde la configuración de tu cuenta.
            </p>
          </>
        )}

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-bark-900)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
        >
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
