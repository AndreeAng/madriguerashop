import { describe, it, expect } from "vitest";

// `encryptSecret`/`decryptSecret` leen `ENCRYPTION_KEY` de forma perezosa
// (en la primera llamada) y cachean la clave a nivel de módulo. Seteamos una
// clave canónica (base64 de 32 bytes, el mismo formato que produce
// `openssl rand -base64 32`) ANTES de importar el módulo para ejercer el
// camino de producción, no el fallback scrypt de dev.
process.env.ENCRYPTION_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef", // exactamente 32 bytes
).toString("base64");

const {
  encryptSecret,
  decryptSecret,
  looksEncrypted,
} = await import("@/lib/crypto/encrypt");

describe("encryptSecret / decryptSecret — round-trip", () => {
  it("descifra exactamente lo que cifró (ASCII)", () => {
    const plain = "token-delegado-siat-abc123";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("preserva unicode y multibyte (acentos, emoji)", () => {
    const plain = "contraseña ñoño 🔐 café";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("preserva strings largos", () => {
    const plain = "x".repeat(10_000);
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("el string vacío es un no-op en ambas direcciones", () => {
    // Un secreto vacío significa 'sin secreto configurado'. Cifrarlo a un
    // payload no-vacío rompería `looksEncrypted` y forzaría descifrados
    // innecesarios; por eso el contrato es que "" → "".
    expect(encryptSecret("")).toBe("");
    expect(decryptSecret("")).toBe("");
  });
});

describe("encryptSecret — formato del payload", () => {
  it("emite 'v1:<iv>:<tag>:<ciphertext>' con 4 partes base64", () => {
    const payload = encryptSecret("hola");
    const parts = payload.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    for (const p of parts.slice(1)) {
      expect(p).toMatch(/^[A-Za-z0-9+/]+=*$/);
    }
  });

  it("usa IV único por cifrado → mismo plaintext, payloads distintos", () => {
    // GCM es catastróficamente inseguro si se reusa el IV con la misma
    // clave. Este test guarda contra un futuro refactor que hardcodee el IV
    // o lo derive del plaintext.
    const a = encryptSecret("mismo-secreto");
    const b = encryptSecret("mismo-secreto");
    expect(a).not.toBe(b);
    // Pero ambos descifran al mismo valor.
    expect(decryptSecret(a)).toBe("mismo-secreto");
    expect(decryptSecret(b)).toBe("mismo-secreto");
  });
});

describe("decryptSecret — detección de tampering (auth tag GCM)", () => {
  it("lanza si se altera el ciphertext", () => {
    const payload = encryptSecret("saldo-real");
    const [v, iv, tag, ct] = payload.split(":");
    // Flipeamos un bit del primer byte del ciphertext manteniéndolo base64
    // válido — simula a un atacante con write-access a la DB.
    const bytes = Buffer.from(ct!, "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    const tampered = [v, iv, tag, bytes.toString("base64")].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("lanza si se altera el auth tag", () => {
    const payload = encryptSecret("saldo-real");
    const [v, iv, tag, ct] = payload.split(":");
    const bytes = Buffer.from(tag!, "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    const tampered = [v, iv, bytes.toString("base64"), ct].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("decryptSecret — payloads mal formados", () => {
  it("lanza con basura sin estructura", () => {
    expect(() => decryptSecret("no-es-un-payload")).toThrow();
  });

  it("lanza con versión no soportada", () => {
    const payload = encryptSecret("x");
    const bumped = payload.replace(/^v1:/, "v2:");
    expect(() => decryptSecret(bumped)).toThrow(/versión no soportada|mal formado/i);
  });

  it("lanza con cantidad de partes incorrecta", () => {
    expect(() => decryptSecret("v1:solo:tres")).toThrow();
    expect(() => decryptSecret("v1:a:b:c:d")).toThrow();
  });

  it("lanza con IV de dimensión inválida", () => {
    const payload = encryptSecret("x");
    const [v, , tag, ct] = payload.split(":");
    const shortIv = Buffer.alloc(4).toString("base64"); // 4 bytes, no 12
    expect(() => decryptSecret([v, shortIv, tag, ct].join(":"))).toThrow(
      /dimensiones inválidas/i,
    );
  });

  it("lanza con tag de dimensión inválida", () => {
    const payload = encryptSecret("x");
    const [v, iv, , ct] = payload.split(":");
    const shortTag = Buffer.alloc(8).toString("base64"); // 8 bytes, no 16
    expect(() => decryptSecret([v, iv, shortTag, ct].join(":"))).toThrow(
      /dimensiones inválidas/i,
    );
  });
});

describe("looksEncrypted", () => {
  it("reconoce un payload real", () => {
    expect(looksEncrypted(encryptSecret("hola"))).toBe(true);
  });

  it("rechaza plaintext plano", () => {
    expect(looksEncrypted("hola")).toBe(false);
    expect(looksEncrypted("")).toBe(false);
  });

  it("rechaza el prefijo correcto pero cantidad de partes incorrecta", () => {
    expect(looksEncrypted("v1:solo:dos")).toBe(false);
    expect(looksEncrypted("v1:a:b:c:d")).toBe(false);
  });

  it("rechaza otra versión", () => {
    expect(looksEncrypted("v2:a:b:c")).toBe(false);
  });
});
