"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

/**
 * Badge "tenés pedidos nuevos" en el header del dashboard.
 *
 * Polling cada 30s a `/api/dashboard/orders-meta`. Si detecta un pedido
 * cuyo `latestOrderId` cambió desde la última lectura visible al usuario
 * (guardado en localStorage), reproduce un sonido corto para alertar al
 * owner aunque esté en otra pestaña.
 *
 * El polling pausa cuando la pestaña está oculta (Page Visibility API) y
 * resume al volver al foreground — esto evita gastar quota de DB con
 * tabs abiertas pero olvidadas.
 */

const POLL_MS = 30_000;
const STORAGE_KEY = "nibble:lastSeenOrderId";

// Beep corto generado con WebAudio (no requerimos asset MP3). Frecuencia y
// duración elegidas para ser audibles pero no molestas en oficina.
function playBeep() {
  try {
    const Ctx =
      typeof window !== "undefined"
        ? (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)
        : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // WebAudio bloqueado por browser policy (ej. tab nunca recibió interacción).
    // Silenciamos — el badge visual sigue funcionando.
  }
}

type Meta = {
  activeCount: number;
  awaitingCount: number;
  latestOrderId: string | null;
  latestOrderAt: string | null;
};

export function LiveOrderBadge({
  initialActive,
  initialAwaiting,
}: {
  initialActive: number;
  initialAwaiting: number;
}) {
  const [meta, setMeta] = useState<Meta>({
    activeCount: initialActive,
    awaitingCount: initialAwaiting,
    latestOrderId: null,
    latestOrderAt: null,
  });
  const lastSeenRef = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function poll() {
      try {
        const res = await fetch("/api/dashboard/orders-meta", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: Meta = await res.json();
        if (cancelled) return;
        setMeta(data);

        if (
          data.latestOrderId &&
          lastSeenRef.current &&
          data.latestOrderId !== lastSeenRef.current
        ) {
          // Pedido NUEVO desde el último que el usuario vio en su tab.
          playBeep();
        }
        // No actualizamos `lastSeenRef` acá: lo movemos solo cuando el
        // usuario navega a `/dashboard/pedidos` (ver markSeen abajo) —
        // así el badge sigue sonando si el owner ignora el primer beep.
        if (lastSeenRef.current === null && data.latestOrderId) {
          lastSeenRef.current = data.latestOrderId;
          localStorage.setItem(STORAGE_KEY, data.latestOrderId);
        }
      } catch {
        /* network error: silencioso, intentamos en el próximo tick */
      }
    }

    function schedule() {
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") await poll();
        if (!cancelled) schedule();
      }, POLL_MS);
    }

    // Primera corrida inmediata si la pestaña está activa
    if (document.visibilityState === "visible") void poll();
    schedule();

    // Volver al foreground → poll inmediato
    function onVisibility() {
      if (document.visibilityState === "visible") void poll();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const total = meta.awaitingCount + Math.max(0, meta.activeCount);
  const hasNew = meta.awaitingCount > 0 || meta.activeCount > 0;

  return (
    <Link
      href="/dashboard/pedidos"
      aria-label={
        total > 0
          ? `${total} pedido${total === 1 ? "" : "s"} por atender`
          : "Pedidos"
      }
      onClick={() => {
        if (meta.latestOrderId) {
          lastSeenRef.current = meta.latestOrderId;
          localStorage.setItem(STORAGE_KEY, meta.latestOrderId);
        }
      }}
      className="relative inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--line)] hover:border-[color:var(--color-bark-300)]"
    >
      <Bell className="size-4" />
      {hasNew && (
        <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[color:var(--color-amber-500)] px-1 text-[10px] font-bold text-white">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}
