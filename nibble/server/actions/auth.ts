"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { isValidIdentifier } from "@/lib/auth/identifiers";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresá tu email o teléfono").refine(isValidIdentifier, {
    message: "Email o teléfono inválido",
  }),
  password: z.string().min(1, "Ingresá tu contraseña"),
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
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "username" | "password" | undefined;
      if (key) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn() lanza redirect — eso NO es error real
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    if (error instanceof AuthError) {
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
  await signOut({ redirectTo: "/" });
}
