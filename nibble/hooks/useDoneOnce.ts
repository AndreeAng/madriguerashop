"use client";

import { useEffect, useRef } from "react";

/**
 * Dispara `cb` una sola vez por "ciclo" de éxito. Mientras `ok` sigue en
 * true no re-dispara; cuando `ok` vuelve a false (p.ej. el caller resetea
 * el state para una nueva action), el flag se resetea y el siguiente
 * `ok=true` vuelve a disparar.
 *
 * Patrón ref-stable: `cb` se guarda en un ref para que el efecto solo
 * dependa de `ok`. Esto evita re-suscripciones por callbacks inline
 * (`useDoneOnce(ok, () => setOpen(false))`) que cambian de identidad en
 * cada render — sin el ref, el efecto se re-corría y, aunque hoy no
 * dispara doble por el guard `fired.current`, un cambio futuro en la
 * semántica podía introducir re-firings sutiles.
 */
export function useDoneOnce(ok: boolean | undefined, cb: () => void): void {
  const fired = useRef(false);
  const cbRef = useRef(cb);
  // Sincronizamos el ref con la última `cb` recibida sin disparar el
  // efecto principal.
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    if (!ok) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    cbRef.current();
  }, [ok]);
}
