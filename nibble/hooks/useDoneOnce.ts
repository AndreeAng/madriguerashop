"use client";

import { useEffect, useRef } from "react";

/**
 * Dispara `cb` una sola vez cuando `ok` pasa de falsy a true. Útil para
 * cerrar modales / refrescar UI tras una server action exitosa sin
 * re-disparar en cada re-render mientras `state.ok` siga siendo true.
 */
export function useDoneOnce(ok: boolean | undefined, cb: () => void): void {
  const fired = useRef(false);
  useEffect(() => {
    if (ok && !fired.current) {
      fired.current = true;
      cb();
    }
  }, [ok, cb]);
}
