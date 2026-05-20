import { describe, it, expect } from "vitest";
import {
  generateRecoveryTokenPlain,
  hashRecoveryToken,
  isValidRecoveryTokenFormat,
  RECOVERY_TOKEN_HEX_LEN,
} from "@/lib/auth/recovery-token";

describe("generateRecoveryTokenPlain", () => {
  it("genera 64 chars hex (32 bytes)", () => {
    const token = generateRecoveryTokenPlain();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("dos tokens consecutivos son distintos (256 bits entropía)", () => {
    const a = generateRecoveryTokenPlain();
    const b = generateRecoveryTokenPlain();
    expect(a).not.toBe(b);
  });

  it("100 tokens son todos únicos", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateRecoveryTokenPlain());
    expect(tokens.size).toBe(100);
  });
});

describe("hashRecoveryToken", () => {
  it("hash determinista del mismo plain", () => {
    const plain = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(hashRecoveryToken(plain)).toBe(hashRecoveryToken(plain));
  });

  it("hash distinto para plains distintos", () => {
    const a = generateRecoveryTokenPlain();
    const b = generateRecoveryTokenPlain();
    expect(hashRecoveryToken(a)).not.toBe(hashRecoveryToken(b));
  });

  it("hash tiene 64 chars hex (SHA-256)", () => {
    const hash = hashRecoveryToken("anything");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash del plano NO es el plano (no es identidad)", () => {
    const plain = "a".repeat(64);
    expect(hashRecoveryToken(plain)).not.toBe(plain);
  });
});

describe("isValidRecoveryTokenFormat", () => {
  it("acepta token bien formado", () => {
    expect(isValidRecoveryTokenFormat(generateRecoveryTokenPlain())).toBe(true);
  });

  it("rechaza largo incorrecto", () => {
    expect(isValidRecoveryTokenFormat("a".repeat(63))).toBe(false);
    expect(isValidRecoveryTokenFormat("a".repeat(65))).toBe(false);
    expect(isValidRecoveryTokenFormat("")).toBe(false);
  });

  it("rechaza caracteres no hex", () => {
    // Mayúsculas no son válidas (la regex es [a-f0-9])
    expect(isValidRecoveryTokenFormat("A".repeat(64))).toBe(false);
    // Símbolos
    expect(isValidRecoveryTokenFormat("z".repeat(64))).toBe(false);
    expect(isValidRecoveryTokenFormat("!".repeat(64))).toBe(false);
  });

  it("rechaza payloads de path traversal / SQL injection", () => {
    expect(isValidRecoveryTokenFormat("../../../etc/passwd")).toBe(false);
    expect(isValidRecoveryTokenFormat("'; DROP TABLE users; --")).toBe(false);
  });
});

describe("RECOVERY_TOKEN_HEX_LEN", () => {
  it("coincide con el largo esperado del hash", () => {
    expect(RECOVERY_TOKEN_HEX_LEN).toBe(64);
    expect(hashRecoveryToken("x")).toHaveLength(RECOVERY_TOKEN_HEX_LEN);
  });
});
