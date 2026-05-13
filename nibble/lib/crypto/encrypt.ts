import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Cifrado simétrico para secretos almacenados en DB.
 *
 * Algoritmo: AES-256-GCM.
 *   - 256 bits de clave → no factible romper.
 *   - GCM provee confidencialidad + autenticación (auth tag de 128 bits).
 *     Si un atacante con write-access a la DB flippea bits del ciphertext,
 *     el decrypt falla en lugar de devolver basura silenciosamente.
 *
 * Formato del payload guardado en DB:
 *     "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
 *
 *  - `v1` permite rotar algoritmo en el futuro (v2: AES-256-GCM-SIV, etc).
 *  - `iv` debe ser único por encriptación (12 bytes random para GCM).
 *  - `tag` es el output de auth del GCM (16 bytes).
 *  - `ciphertext` es el plaintext cifrado.
 *
 * Clave: deriva de `ENCRYPTION_KEY` (32 bytes base64 mínimo, o una passphrase
 * humana que se expande con scrypt). DEBE vivir en env var separada de
 * `DATABASE_URL` para que un leak de creds de DB no rompa el cifrado.
 */

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits — recomendado para GCM
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY no seteada. Generala con: openssl rand -base64 32",
    );
  }
  // Si el valor parece base64 de 32+ bytes, usalo directo. Sino, derivar con
  // scrypt desde la string como passphrase (más lento pero acepta cualquier valor).
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 43) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length >= KEY_LEN) {
      cachedKey = buf.subarray(0, KEY_LEN);
      return cachedKey;
    }
  }
  // Fallback: derivar de la passphrase con scrypt (salt fija para que el
  // mismo ENCRYPTION_KEY produzca la misma clave entre boots).
  cachedKey = scryptSync(raw, "nibble-encrypt-v1", KEY_LEN);
  return cachedKey;
}

/**
 * Cifra un string con AES-256-GCM. Devuelve el payload completo serializado.
 * Lanza si `ENCRYPTION_KEY` no está seteada.
 */
export function encryptSecret(plain: string): string {
  if (plain === "") return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

/**
 * Descifra un payload generado por `encryptSecret`. Lanza si el tag no
 * coincide (tampering detectado) o si la clave es la equivocada.
 */
export function decryptSecret(payload: string): string {
  if (payload === "") return "";
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Payload cifrado mal formado o versión no soportada");
  }
  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const enc = Buffer.from(parts[3]!, "base64");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("Payload cifrado con dimensiones inválidas");
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

/** Indica si el payload tiene el formato esperado por `decryptSecret`. */
export function looksEncrypted(value: string): boolean {
  return value.startsWith("v1:") && value.split(":").length === 4;
}
