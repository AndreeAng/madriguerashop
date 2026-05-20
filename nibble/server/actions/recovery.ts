"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizeIdentifier, isValidIdentifier } from "@/lib/auth/identifiers";
import {
  generateRecoveryTokenPlain,
  hashRecoveryToken,
  isValidRecoveryTokenFormat,
  RECOVERY_TOKEN_HEX_LEN,
} from "@/lib/auth/recovery-token";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import { appUrl } from "@/lib/email/client";
import { audit } from "@/lib/audit/log";
import { rateLimit, getClientIp, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";

// ============== Constantes ==============

/** Tiempo de validez del token de reset, en milisegundos. */
const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hora

// ============== Request reset ==============

const requestSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Ingresa tu email o teléfono")
    .refine(isValidIdentifier, "Email o teléfono inválido"),
});

export type RequestResetState = {
  ok?: true;
  fieldErrors?: Partial<Record<"identifier", string>>;
  /** Mensaje genérico — no revelamos si el usuario existe. */
  noticeKey?: "sent";
};

/**
 * Crea (o recicla) un PasswordReset y envía el email.
 *
 * Anti-enumeración: SIEMPRE retornamos éxito visible al usuario, hayamos
 * encontrado o no la cuenta. La diferencia se ve sólo en logs.
 */
export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  // Rate limit por IP — 3/min protege contra spam de tokens
  const ip = await getClientIp();
  const rl = await rateLimit(`recovery:${ip}`, 3, 60 * 1000);
  if (!rl.success) {
    return { fieldErrors: { identifier: rateLimitErrorMessage(rl.retryAfter) } };
  }

  const parsed = requestSchema.safeParse({ identifier: formData.get("identifier") });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<"identifier">(parsed.error) };
  }

  const ident = normalizeIdentifier(parsed.data.identifier);
  const user = await db.user.findUnique({
    where: { username: ident.value },
    select: { id: true, email: true, fullName: true, isActive: true },
  });

  // Si no existe o no tiene email, NO le decimos al cliente. Logueamos solo
  // el tipo de identifier (kind) para ops — NUNCA el valor, para no filtrar
  // PII a los logs centralizados.
  //
  // ANTI-TIMING: el path happy (user válido con email) ejecuta hashPassword
  // + transacción DB + SMTP (~200-500ms). El path no-user retornaba en
  // ~1-5ms — un atacante con ping estable puede distinguir ambos casos
  // por latencia incluso con la misma respuesta visible. Equilibramos
  // ejecutando un hash bcrypt dummy en el path negativo: añade ~150ms
  // de costo CPU que iguala el orden de magnitud sin completar el flujo
  // de envío. No es perfecto (el SMTP del happy path agrega varianza
  // de red) pero cierra el oracle más obvio.
  if (!user || !user.isActive) {
    console.log("[recovery] no-user-for", ident.kind);
    await hashPassword(`__timing_dummy_${ident.value}__`);
    return { ok: true, noticeKey: "sent" };
  }

  if (!user.email) {
    console.log("[recovery] user-without-email");
    // Devolvemos `sent` (no `no_email`) para no leakear que existe una cuenta
    // sin email — un atacante que prueba teléfonos no debe poder distinguir
    // "no existe la cuenta" de "existe pero es phone-only". Quien realmente
    // pierda su acceso por no tener email registrado debe contactar soporte
    // vía WhatsApp; ese canal lo orienta sin exponer información a terceros.
    await hashPassword(`__timing_dummy_${ident.value}__`);
    return { ok: true, noticeKey: "sent" };
  }

  // Rate limit POR USUARIO (además del rate limit por IP arriba). Un attacker
  // con IPs rotativas puede generar 3 × N tokens/minuto contra el mismo
  // identifier — flood al inbox de la víctima. El token previo se invalida
  // en cada request (línea siguiente), pero el email se sigue enviando. Con
  // este bucket capamos a 3 reset emails / 15 min por user, independiente
  // de cuántas IPs los disparen.
  const rlUser = await rateLimit(`recovery:user:${user.id}`, 3, 15 * 60 * 1000);
  if (!rlUser.success) {
    // Mismo `ok: true` para no leakear que existe la cuenta — el atacante no
    // distingue "throttled" de "no enviado por bug interno". El usuario
    // legítimo ya recibió un email previo y debe usarlo.
    return { ok: true, noticeKey: "sent" };
  }

  // Generar token plano (lo que va al URL del email) y guardar SOLO el hash
  // en DB. Si la tabla leakea, los tokens no son utilizables directamente.
  // Invalidamos cualquier token previo del usuario en la misma transacción
  // para prevenir token flooding.
  const tokenPlain = generateRecoveryTokenPlain();
  const tokenHash = hashRecoveryToken(tokenPlain);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.$transaction([
    db.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordReset.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    }),
  ]);

  // Enviar email — el plano viaja solo por el canal de email.
  const resetUrl = `${appUrl()}/recovery/${tokenPlain}`;
  const result = await sendEmail(
    passwordResetEmail({
      to: user.email,
      resetUrl,
      expiresAt,
    }),
  );

  // Si SMTP falla, NO mostramos error al usuario (anti-enumeración: igual
  // mostramos noticeKey="sent"). Pero auditamos el fallo para que ops note
  // el problema — sin esto, los emails de recovery podrían fallar
  // silenciosamente durante días.
  await audit({
    action: "auth.password_reset.requested",
    actorId: user.id,
    // Target = user.id, no el identifier crudo (sería PII en logs).
    target: user.id,
    metadata: result.delivered
      ? { kind: ident.kind, delivered: true }
      : { kind: ident.kind, delivered: false, reason: result.reason },
  });

  return { ok: true, noticeKey: "sent" };
}

// ============== Complete reset ==============

const completeSchema = z
  .object({
    token: z
      .string()
      .length(RECOVERY_TOKEN_HEX_LEN, "Token inválido")
      .refine(isValidRecoveryTokenFormat, "Token inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres").max(MAX_PASSWORD_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type CompleteResetState = {
  ok?: true;
  error?: string;
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string>>;
};

export async function completePasswordResetAction(
  _prev: CompleteResetState,
  formData: FormData,
): Promise<CompleteResetState> {
  // Rate limit: 10 intentos / min por IP. Sin esto, un atacante con un token
  // capturado puede hacer N requests sin throttle.
  const ip = await getClientIp();
  const rl = await rateLimit(`reset-complete:${ip}`, 10, 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
  }

  const parsed = completeSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<"password" | "confirmPassword">(parsed.error),
    };
  }

  // El URL trae el token plano; en DB guardamos el hash. Hasheamos input
  // antes del lookup.
  const tokenHash = hashRecoveryToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  // TOCTOU-safe: consumimos el token con un `updateMany` condicional
  // `usedAt: null AND expiresAt > now` dentro de la transacción. Si dos
  // requests con el mismo token llegan en paralelo, solo una hace
  // `count === 1` y procede; la otra ve `count === 0` y se aborta.
  // Sin este patrón, ambas requests pasaban el `findUnique + check`
  // y ambas sobreescribían el `passwordHash` — un atacante podía
  // race contra la víctima legítima por el control del password final.
  let userId: string | null = null;
  try {
    userId = await db.$transaction(async (tx) => {
      const reset = await tx.passwordReset.findUnique({
        where: { token: tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      });
      if (!reset) throw new Error("__invalid__");
      if (reset.usedAt) throw new Error("__used__");
      if (reset.expiresAt < now) throw new Error("__expired__");

      // Consumo atómico: si otra request ya lo marcó usado entre el find
      // y este update, `count` será 0 y abortamos sin tocar el password.
      const claimed = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("__race__");

      await tx.user.update({
        where: { id: reset.userId },
        // `passwordChangedAt` invalida cualquier JWT activo en el próximo
        // revalidate (ver auth.ts callback). Sin esto, si un atacante
        // capturó el link de recovery mientras la víctima estaba logueada,
        // ambas sesiones convivían hasta el siguiente login.
        data: { passwordHash, passwordChangedAt: now },
      });

      // Invalidar el resto de tokens del usuario
      await tx.passwordReset.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: now },
      });

      return reset.userId;
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "__invalid__" || err.message === "__used__" || err.message === "__race__") {
        return { error: "Link inválido o ya usado." };
      }
      if (err.message === "__expired__") {
        return { error: "El link expiró. Solicita uno nuevo." };
      }
    }
    throw err;
  }

  await audit({
    action: "auth.password_reset.completed",
    actorId: userId,
  });

  return { ok: true };
}
