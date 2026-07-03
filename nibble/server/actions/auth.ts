"use server";

import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isValidIdentifier, normalizeIdentifier } from "@/lib/auth/identifiers";
import { audit } from "@/lib/audit/log";
import { rateLimit, getClientIp, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu email o teléfono").refine(isValidIdentifier, {
    message: "Email o teléfono inválido",
  }),
  password: z.string().min(1, "Ingresa tu contraseña").max(MAX_PASSWORD_LENGTH),
});

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"username" | "password", string>>;
};

/**
 * Server action de login.
 * Si el callback `signIn` retorna sin error, NextAuth redirige
 * (acá lanzamos `redirect`-like via `signIn` con `redirectTo`).
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // Rate limit POR IP: 10 intentos / 5 min protege contra credential stuffing
  // desde una sola IP.
  const ip = await getClientIp();
  const rlIp = await rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!rlIp.success) {
    return { error: rateLimitErrorMessage(rlIp.retryAfter) };
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<"username" | "password">(parsed.error),
    };
  }

  const identifier = normalizeIdentifier(parsed.data.username).value;

  // Rate limit POR USUARIO: 20 intentos / 15 min. Esto cierra el vector de
  // credential stuffing distribuido (botnet con N IPs, todas atacando el
  // mismo identifier) que el limit por IP no detiene. El error es el mismo
  // genérico para no leakear si el usuario existe.
  const rlUser = await rateLimit(`login:id:${identifier}`, 20, 15 * 60 * 1000);
  if (!rlUser.success) {
    return { error: rateLimitErrorMessage(rlUser.retryAfter) };
  }

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn() lanza un redirect cuando el login es exitoso. isRedirectError es
    // robusto entre versiones de Next; comparar contra "NEXT_REDIRECT" no.
    if (isRedirectError(error)) {
      await audit({
        action: "auth.login.success",
        target: identifier,
      });
      throw error;
    }
    if (error instanceof AuthError) {
      // Login fallado — auditamos sin filtrar la password
      await audit({
        action: "auth.login.failed",
        target: identifier,
        metadata: { reason: error.type },
      });
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email/teléfono o contraseña incorrectos." };
        default:
          return { error: "No pudimos iniciar sesión. Prueba de nuevo." };
      }
    }
    throw error;
  }

  return {};
}

// NOTA: el logout vive en `auth-signout.ts` (signOutAction) — acá existía
// un `logoutAction` duplicado que ninguna UI usaba; su audit de
// "auth.logout" se movió a signOutAction al eliminarlo.
