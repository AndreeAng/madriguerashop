import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  pickFirstIp,
  getClientIpFromRequest,
} from "@/lib/security/rateLimit";

/**
 * Tests del extractor de IP del rate limiter.
 *
 * El bug que blindan estos tests:
 *   - `x-forwarded-for` falsificado por el cliente bypassea el limiter si
 *     el server lo lee sin validar que venga de un proxy confiable. El fix
 *     introdujo `pickFirstIp` (filtra garbage) y `trustProxy()` (require
 *     RATE_LIMIT_TRUST_PROXY=true o VERCEL=1 para leer el header).
 *
 * Si alguien quita el filtro de IP o confía siempre en el header, estos
 * tests fallan.
 */

describe("pickFirstIp", () => {
  it("retorna null para header ausente", () => {
    expect(pickFirstIp(null)).toBe(null);
  });

  it("retorna null para string vacío", () => {
    expect(pickFirstIp("")).toBe(null);
    expect(pickFirstIp("   ")).toBe(null);
  });

  it("acepta IPv4 dotted-quad", () => {
    expect(pickFirstIp("203.0.113.42")).toBe("203.0.113.42");
  });

  it("acepta IPv6", () => {
    expect(pickFirstIp("2001:db8::1")).toBe("2001:db8::1");
    expect(pickFirstIp("::1")).toBe("::1");
  });

  it("toma SOLO el primer hop cuando hay múltiples", () => {
    // Patrón de CDN/proxy: "client, proxy1, proxy2". El cliente real es el primero.
    expect(pickFirstIp("203.0.113.42, 10.0.0.1, 10.0.0.2")).toBe(
      "203.0.113.42",
    );
  });

  it("trim del whitespace alrededor", () => {
    expect(pickFirstIp("  203.0.113.42  ")).toBe("203.0.113.42");
  });

  it("rechaza strings que no parecen IP — protege la key del Map", () => {
    // Un atacante mandando garbage para inflar el Map en el fallback in-memory.
    expect(pickFirstIp("evil-string")).toBe(null);
    expect(pickFirstIp("'; DROP TABLE")).toBe(null);
    expect(pickFirstIp("<script>")).toBe(null);
    expect(pickFirstIp("../etc/passwd")).toBe(null);
  });

  it("rechaza header demasiado largo (>45 chars)", () => {
    // IPv6 más largo legítimo es ~39 chars. Más allá de 45 es garbage.
    const tooLong = "a".repeat(46);
    expect(pickFirstIp(tooLong)).toBe(null);
  });

  it("acepta IPv6 con zona ID corto", () => {
    expect(pickFirstIp("fe80::1")).toBe("fe80::1");
  });
});

describe("getClientIpFromRequest — gating por TRUST_PROXY", () => {
  // Manipulamos `process.env` ANTES de cada test. La función lee las
  // envs en cada llamada (no en init de módulo), así que el flip toma efecto.
  const originalTrust = process.env.RATE_LIMIT_TRUST_PROXY;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    delete process.env.RATE_LIMIT_TRUST_PROXY;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalTrust !== undefined) {
      process.env.RATE_LIMIT_TRUST_PROXY = originalTrust;
    }
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    }
  });

  function reqWith(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  it("sin proxy confiable: retorna 'unknown' aunque haya x-forwarded-for", () => {
    // Este es el caso crítico: sin RATE_LIMIT_TRUST_PROXY ni VERCEL, NO
    // confiamos en el header. Si lo hiciéramos, un atacante en VPS sin
    // nginx configurado podría falsificar la IP para bypasear el limiter.
    const r = reqWith({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIpFromRequest(r)).toBe("unknown");
  });

  it("con RATE_LIMIT_TRUST_PROXY=true: lee x-forwarded-for", () => {
    process.env.RATE_LIMIT_TRUST_PROXY = "true";
    const r = reqWith({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIpFromRequest(r)).toBe("1.2.3.4");
  });

  it("con VERCEL=1: lee x-forwarded-for (Vercel siempre garantiza el header)", () => {
    process.env.VERCEL = "1";
    const r = reqWith({ "x-forwarded-for": "203.0.113.42" });
    expect(getClientIpFromRequest(r)).toBe("203.0.113.42");
  });

  it("RATE_LIMIT_TRUST_PROXY=falsy NO activa la confianza", () => {
    process.env.RATE_LIMIT_TRUST_PROXY = "false";
    const r = reqWith({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIpFromRequest(r)).toBe("unknown");

    process.env.RATE_LIMIT_TRUST_PROXY = "1"; // intencionalmente NO es "true"
    expect(getClientIpFromRequest(r)).toBe("unknown");
  });

  it("con proxy confiable + header garbage: cae a 'unknown' en vez de usar garbage", () => {
    // Defensa en profundidad: aunque confiemos en el proxy, si el header
    // tiene basura (proxy mal configurado, atacante en cadena, etc.),
    // NO usamos esa basura como key del rate limiter.
    process.env.VERCEL = "1";
    const r = reqWith({ "x-forwarded-for": "<script>alert(1)</script>" });
    expect(getClientIpFromRequest(r)).toBe("unknown");
  });

  it("con proxy confiable: x-real-ip como fallback cuando no hay x-forwarded-for", () => {
    process.env.VERCEL = "1";
    const r = reqWith({ "x-real-ip": "203.0.113.99" });
    expect(getClientIpFromRequest(r)).toBe("203.0.113.99");
  });

  it("con proxy confiable + multi-hop: usa el primer IP (cliente real)", () => {
    process.env.VERCEL = "1";
    const r = reqWith({
      "x-forwarded-for": "203.0.113.42, 10.0.0.1, 172.16.0.1",
    });
    expect(getClientIpFromRequest(r)).toBe("203.0.113.42");
  });
});
