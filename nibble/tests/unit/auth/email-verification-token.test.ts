import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import {
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
} from "@/lib/auth/email-verification-token";

// El módulo lee `process.env.AUTH_SECRET` en cada llamada a `hmac()`.
// Como las funciones son síncronas + stateless, basta setear la env var
// antes de generar/verificar — no necesitamos mocks de DB.
const TEST_SECRET = "test-secret-32-chars-not-real-aaaaa";

beforeAll(() => {
  process.env.AUTH_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.AUTH_SECRET;
});

describe("generateEmailVerificationToken / verifyEmailVerificationToken", () => {
  it("genera y verifica un token válido", () => {
    const userId = "user_123";
    const email = "test@example.com";
    const token = generateEmailVerificationToken(userId, email);
    const result = verifyEmailVerificationToken(token);
    expect(result).toEqual({ ok: true, userId, email });
  });

  it("token tiene formato base64url.base64url", () => {
    const token = generateEmailVerificationToken("u", "a@b.co");
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("rechaza token con un solo segmento", () => {
    expect(verifyEmailVerificationToken("just-a-string")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rechaza token con tres segmentos", () => {
    expect(verifyEmailVerificationToken("a.b.c")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rechaza token con firma incorrecta", () => {
    const token = generateEmailVerificationToken("u1", "a@b.co");
    const [payload] = token.split(".");
    const tampered = `${payload}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    expect(verifyEmailVerificationToken(tampered)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rechaza token con payload modificado (firma queda inválida)", () => {
    const token = generateEmailVerificationToken("u1", "a@b.co");
    const [, sig] = token.split(".");
    // Construimos un payload distinto con la firma vieja → bad_signature
    const newPayload = Buffer.from(
      JSON.stringify({ uid: "attacker", email: "evil@x.com", exp: Date.now() + 1000 }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifyEmailVerificationToken(`${newPayload}.${sig}`)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rechaza token expirado", () => {
    // Generamos con un secret distinto pero firmando con uno fijo: simplemente
    // adelantamos el tiempo del sistema con vi.useFakeTimers para verificar
    // el branch de exp.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = generateEmailVerificationToken("u1", "a@b.co");
    // Avanzamos 25h (TTL = 24h)
    vi.setSystemTime(new Date("2026-01-02T01:00:00Z"));
    expect(verifyEmailVerificationToken(token)).toEqual({
      ok: false,
      reason: "expired",
    });
    vi.useRealTimers();
  });

  it("dos tokens del mismo input son distintos (exp varía con Date.now)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const t1 = generateEmailVerificationToken("u", "a@b.co");
    vi.setSystemTime(new Date("2026-01-01T00:00:01Z"));
    const t2 = generateEmailVerificationToken("u", "a@b.co");
    expect(t1).not.toBe(t2);
    vi.useRealTimers();
  });

  it("dos tokens con mismo exp son IDÉNTICOS (deterministic HMAC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const t1 = generateEmailVerificationToken("u", "a@b.co");
    // Sin avanzar el reloj — mismo exp → mismo payload → mismo HMAC
    const t2 = generateEmailVerificationToken("u", "a@b.co");
    expect(t1).toBe(t2);
    vi.useRealTimers();
  });

  it("email bindeado: cambiar email del usuario invalida tokens viejos del payload", () => {
    // Esto valida el FIX de la ronda 3: el token incluye el email para
    // que un admin que cambia el email no permita verificar el nuevo
    // email con un link viejo. El verify retorna el email DEL TOKEN; el
    // caller debe contrastar contra el email actual del usuario en DB.
    const oldEmail = "old@example.com";
    const newEmail = "new@example.com";
    const token = generateEmailVerificationToken("u", oldEmail);
    const result = verifyEmailVerificationToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe(oldEmail);
      // El caller hace: WHERE id = userId AND email = result.email — si el
      // email actual ya no es oldEmail, el updateMany no encuentra match.
      expect(result.email).not.toBe(newEmail);
    }
  });

  it("rechaza payload sin `uid`", () => {
    // Forzamos payload sin uid
    const evilPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 1000 }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    // Firmamos correctamente con el secret del test
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(evilPayload)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifyEmailVerificationToken(`${evilPayload}.${sig}`)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
