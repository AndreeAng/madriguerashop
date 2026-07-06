import { describe, it, expect } from "vitest";
import { z, type ZodError } from "zod";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";

/**
 * `zodIssuesToFieldErrors` proyecta los issues de Zod a `{ campo: mensaje }`
 * que las server actions devuelven como `fieldErrors`. Este patrón estaba
 * copiado en 14 archivos; el test fija su contrato.
 */

describe("zodIssuesToFieldErrors — desde safeParse real", () => {
  it("mapea un mensaje por cada campo que falla", () => {
    const schema = z.object({
      email: z.string().min(3),
      password: z.string().min(8),
    });
    const result = schema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    const fe = zodIssuesToFieldErrors<"email" | "password">(result.error!);
    expect(Object.keys(fe).sort()).toEqual(["email", "password"]);
    expect(fe.email).toBeTruthy();
    expect(fe.password).toBeTruthy();
  });

  it("proyecta paths anidados al primer nivel (path[0])", () => {
    const schema = z.object({ user: z.object({ name: z.string().min(1) }) });
    const result = schema.safeParse({ user: { name: "" } });
    const fe = zodIssuesToFieldErrors<"user">(result.error!);
    expect(fe.user).toBeTruthy(); // key = "user", no "user.name"
  });
});

describe("zodIssuesToFieldErrors — reglas de proyección", () => {
  // Construimos los issues a mano para controlar exactamente el orden y los
  // paths — más determinista que depender del orden interno de checks de Zod.
  const fakeError = (issues: { path: (string | number)[]; message: string }[]) =>
    ({ issues } as unknown as ZodError);

  it("el PRIMER mensaje por campo gana (ignora los siguientes del mismo path)", () => {
    const fe = zodIssuesToFieldErrors<"email">(
      fakeError([
        { path: ["email"], message: "primero" },
        { path: ["email"], message: "segundo" },
      ]),
    );
    expect(fe.email).toBe("primero");
    expect(Object.keys(fe)).toEqual(["email"]);
  });

  it("ignora issues sin path (error global, no de campo)", () => {
    const fe = zodIssuesToFieldErrors(
      fakeError([{ path: [], message: "error global" }]),
    );
    expect(fe).toEqual({});
  });

  it("sin issues → objeto vacío", () => {
    expect(zodIssuesToFieldErrors(fakeError([]))).toEqual({});
  });
});
