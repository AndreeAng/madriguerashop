import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

// Hash bcrypt fijo (de un plano aleatorio descartado) usado SOLO para
// igualar el costo de CPU en el path "usuario no existe". Sin esto, un
// login contra un username inexistente retorna en ~1ms (sin bcrypt) vs
// ~100ms para uno válido — un atacante mide la latencia y enumera qué
// cuentas existen. `verifyPasswordDummy` quema el mismo ~100ms sin
// revelar nada. El `recovery.ts` ya aplicaba este patrón; el login no.
const DUMMY_HASH = "$2b$10$PoVDfTCxggKz9PSU/6PI1.TBH.z7R4IvrbnniNNTKfjoei2ezH56W";

export async function verifyPasswordDummy(plain: string): Promise<void> {
  await bcrypt.compare(plain || "x", DUMMY_HASH);
}
