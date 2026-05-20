"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botón de submit con estado pending automático vía `useFormStatus()`.
 * Debe vivir DENTRO de un `<form action={serverAction}>` — el hook lee el
 * status del form padre. Si lo pones afuera, `pending` siempre es false.
 *
 * Variantes:
 *   - `shape`: "rounded" (default, rounded-xl) vs "pill" (rounded-full)
 *   - `width`: "auto" (default) vs "full" (w-full, para auth screens)
 *   - `tone`: "primary" (default, bark-900) vs "ghost" (border-only)
 *
 * Para casos exóticos (icono trailing, spinner explícito), usar `className`
 * para extender — `cn()` mergea bien con tailwind-merge.
 */
type SubmitButtonProps = {
  /** Label cuando NO está pending. Default: "Guardar cambios". */
  children?: ReactNode;
  /** Label cuando ESTÁ pending. Default: "Guardando…". */
  pendingLabel?: ReactNode;
  /** Trailing icon (ej. ArrowRight) cuando no está pending. */
  icon?: ReactNode;
  /** Disable externo además del pending interno. */
  disabled?: boolean;
  shape?: "rounded" | "pill";
  width?: "auto" | "full";
  tone?: "primary" | "ghost";
  size?: "sm" | "md";
  className?: string;
};

export function SubmitButton({
  children = "Guardar cambios",
  pendingLabel = "Guardando…",
  icon,
  disabled,
  shape = "rounded",
  width = "auto",
  tone = "primary",
  size = "md",
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      // `aria-busy` anuncia a screen readers que el botón está en estado
      // "busy/loading" sin que el usuario tenga que volver a leerlo. Sin
      // esto, el cambio visual (spinner + label) es invisible para AT.
      aria-busy={pending || undefined}
      className={cn(
        "press inline-flex items-center justify-center gap-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        shape === "pill" ? "rounded-full" : "rounded-xl",
        width === "full" && "w-full",
        size === "sm" ? "px-4 py-2" : "px-5 py-2.5",
        tone === "ghost"
          ? "border border-[color:var(--line-strong)] text-[color:var(--fg)] hover:bg-[color:var(--bg)]"
          : "bg-[color:var(--color-bark-900)] text-white hover:bg-[color:var(--color-bark-700)]",
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        <>
          {children}
          {icon}
        </>
      )}
    </button>
  );
}
