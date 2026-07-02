import "server-only";

/**
 * Extrae el hostname exacto del bucket Vercel Blob de este proyecto.
 * Formato del token: `vercel_blob_rw_{storeId}_{secret}`.
 * El hostname resultante es `{storeId}.public.blob.vercel-storage.com`.
 *
 * Fallar-seguro: devuelve null si el token no está o no matchea,
 * y los predicados de URL rechazan cualquier URL absoluta en ese caso.
 */
export function getBlobHostname(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const m = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  return m ? `${m[1]}.public.blob.vercel-storage.com` : null;
}

/**
 * Acepta URLs de comprobante de pago originadas en nuestro propio sistema:
 *   - Filesystem (dev): paths bajo `/api/uploads/proof/`
 *   - Vercel Blob (prod): URL del bucket de ESTE proyecto con prefix `/proof/`
 *
 * Valida hostname exacto (no solo sufijo) para bloquear buckets Vercel ajenos.
 */
export function isAcceptedProofUrl(v: string): boolean {
  if (v.startsWith("/api/uploads/proof/")) return true;
  const blobHostname = getBlobHostname();
  if (!blobHostname) return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      u.hostname === blobHostname &&
      u.pathname.startsWith("/proof/")
    );
  } catch {
    return false;
  }
}

/**
 * Acepta URLs de imágenes (categorías, productos, banners) originadas en
 * nuestro sistema de upload:
 *   - Filesystem (dev): paths relativos bajo `/uploads/` o `/api/uploads/`
 *   - Vercel Blob (prod): cualquier subdominio de `.public.blob.vercel-storage.com`
 *     con prefix `/uploads/`
 *
 * Menos estricta que `isAcceptedProofUrl` porque las imágenes no son
 * documentos financieros — el riesgo de una URL ajena es más bajo.
 */
export function isAcceptedUploadUrl(v: string): boolean {
  if (v === "") return true;
  if (v.startsWith("/uploads/")) return true;
  if (v.startsWith("/api/uploads/")) return true;
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".public.blob.vercel-storage.com") &&
      u.pathname.startsWith("/uploads/")
    );
  } catch {
    return false;
  }
}
