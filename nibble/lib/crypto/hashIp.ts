import "server-only";
import crypto from "crypto";

/**
 * Hash determinista de IP con salt rotativa diaria.
 *
 * Por qué hasheamos en vez de guardar la IP cruda:
 *  1. Cumple LOPD Bolivia / GDPR: la IP cruda es PII, el hash con salt
 *     rotativa no permite re-identificación cross-deploy.
 *  2. Permite contar visitantes únicos por día sin retener el dato real.
 *  3. Resiste rainbow tables — la salt deriva de AUTH_SECRET + fecha UTC,
 *     no es predecible para un atacante externo.
 *
 * 22 chars base64 ≈ 132 bits, suficiente para evitar colisiones realistas.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Sin secret no hay garantía de hash impredecible — un attacker que
    // conozca el codebase puede reversar "dev:<day>:<ip>" por brute force
    // del espacio IPv4. En vez de dejar un valor débil persistido, no
    // guardamos IP para ese request. Producción siempre debe tener
    // AUTH_SECRET (auth.ts lo exige al arrancar).
    if (process.env.NODE_ENV === "production") {
      console.error("[hashIp] AUTH_SECRET no seteado en producción — IP no se persiste.");
    }
    return null;
  }
  // Salt rotativa en HORA BOLIVIA, no UTC. Un usuario activo a las 23:30 BOT
  // que sigue activo a las 00:30 BOT debe contar como el MISMO visitante.
  // Con salt UTC, ese mismo usuario aparece como dos visitantes distintos
  // (cruzó las 04:00 UTC entre 20:00 BOT y medianoche BOT del día anterior).
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/La_Paz",
  });
  return crypto
    .createHash("sha256")
    .update(`${secret}:${day}:${ip}`)
    .digest("base64")
    .slice(0, 22);
}
