import "server-only";
import { siatConfig } from "./config";
import { decryptSecret, looksEncrypted } from "@/lib/crypto/encrypt";
import type {
  RecepcionFacturaResponse,
  SiatCredentials,
} from "./types";

/**
 * Cliente SOAP de SIAT — STUB.
 *
 * Implementación real:
 *   1. `npm install soap`
 *   2. Cachear los `soap.createClient()` por endpoint (son caros de crear).
 *   3. Cada llamada agrega header `Authorization: Token <tokenDelegado>`.
 *   4. Map errores de red a `SiatError` con código user-friendly.
 *
 * Activar tras:
 *   - Tener `SIAT_SISTEMA_CODIGO` en env
 *   - Tener token delegado válido para al menos un Store
 */

export class SiatError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Recibe el token tal como vino de DB (idealmente cifrado con AES-256-GCM
 * via `lib/crypto/encrypt`) y devuelve el plano para usarlo en el header
 * SOAP. Si el valor no tiene formato de cifrado, lo asumimos plain (caso
 * legacy / dev sin ENCRYPTION_KEY) y emitimos un warning.
 */
function readTokenDelegado(stored: string): string {
  if (!stored) return "";
  if (looksEncrypted(stored)) {
    try {
      return decryptSecret(stored);
    } catch (err) {
      // decryptSecret tira si la auth tag no valida (tampering) o si la
      // ENCRYPTION_KEY rotó. Sin try-catch acá, el constructor de SiatClient
      // crashea y rompe cualquier flow que dependa de SIAT — preferimos
      // fail-loud con un error tipado que el caller puede mapear a "el
      // merchant tiene que regenerar el token".
      throw new SiatError(
        "token_decrypt_failed",
        "No se pudo descifrar el token SIAT — la clave de cifrado cambió o el dato está corrupto. El merchant tiene que regenerar el token delegado.",
        err,
      );
    }
  }
  console.warn(
    "[siat] tokenDelegado no está cifrado. Cifralo con encryptSecret antes de guardar.",
  );
  return stored;
}

export class SiatClient {
  /** Token delegado en texto plano, descifrado de `creds.tokenDelegado`. */
  private readonly token: string;

  constructor(private creds: SiatCredentials) {
    this.token = readTokenDelegado(creds.tokenDelegado);
  }

  /** Para el header SOAP: `Authorization: Token <token>`. */
  protected getAuthHeader(): string {
    return `Token ${this.token}`;
  }

  /**
   * verificarComunicacion → health check.
   * No requiere CUIS. Útil para validar token y conectividad.
   */
  async verificarComunicacion(): Promise<boolean> {
    throw new SiatError("not_implemented", "SIAT client no activado todavía. Ver lib/billing/siat/README.md");
  }

  /**
   * siniciarSistema → obtiene CUIS.
   */
  async iniciarSistema(): Promise<{ cuis: string; expiresAt: Date }> {
    void siatConfig;
    void this.creds;
    throw new SiatError("not_implemented", "Implementar contra WSDL real cuando tengamos sistemaCodigo");
  }

  /**
   * cufd → obtiene CUFD del día.
   */
  async obtenerCufd(_cuis: string): Promise<{ cufd: string; expiresAt: Date; codigoControl: string }> {
    void this.creds;
    throw new SiatError("not_implemented", "Pendiente: implementar tras certificación SFVL");
  }

  /**
   * recepcionFactura → envía un XML firmado/comprimido al SIN.
   */
  async recepcionFactura(_input: {
    cuis: string;
    cufd: string;
    cuf: string;
    /** XML gzip + base64 */
    archivo: string;
  }): Promise<RecepcionFacturaResponse> {
    void this.creds;
    throw new SiatError("not_implemented", "Pendiente: implementar tras certificación SFVL");
  }

  /**
   * anulacionFactura — sólo dentro de las 96h hábiles.
   */
  async anularFactura(_cuf: string, _motivo: number): Promise<RecepcionFacturaResponse> {
    void this.creds;
    throw new SiatError("not_implemented", "Pendiente");
  }

  /**
   * validacionRecepcionFactura — verificar que SIN tiene la factura.
   */
  async validarRecepcion(_cuf: string): Promise<{
    estado: number;
    descripcion: string;
  }> {
    void this.creds;
    throw new SiatError("not_implemented", "Pendiente");
  }
}
