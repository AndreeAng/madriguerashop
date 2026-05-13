"use server";

import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { isValidIdentifier, normalizeIdentifier } from "@/lib/auth/identifiers";
import { audit } from "@/lib/audit/log";
import { rateLimit, getClientIp, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu email o teléfono").refine(isValidIdentifier, {
    message: "Email o teléfono inválido",
  }),
  password: z.string().min(1, "Ingresa tu contraseña"),
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
  // Rate limit por IP — 10 intentos / 5 min protege contra credential stuffing
  const ip = await getClientIp();
  const rl = await rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
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
          return { error: "No pudimos iniciar sesión. Probá de nuevo." };
      }
    }
    throw error;
  }

  return {};
}

export async function logoutAction() {
  await audit({ action: "auth.logout" });
  await signOut({ redirectTo: "/" });
}
