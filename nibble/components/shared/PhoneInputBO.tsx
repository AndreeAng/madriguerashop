"use client";

import { useMemo, useState } from "react";

/**
 * Input de teléfono boliviano con prefijo `+591` sticky a la izquierda.
 * El cliente sólo tipea los 8 dígitos del celular — no puede borrar el
 * prefijo por error.
 *
 * Internamente expone `<input type="hidden" name={name}>` con el valor
 * concatenado (`+591XXXXXXXX`), así que cualquier form que esperaba el
 * teléfono completo en ese campo sigue funcionando sin cambios.
 *
 * Si el `defaultValue` viene con un prefijo (`+59172345678`), lo
 * extraemos para mostrar solo los dígitos. Si viene un valor sin
 * prefijo o legacy, tomamos los últimos 8 dígitos.
 */
export function PhoneInputBO({
  name,
  defaultValue,
  placeholder,
  error,
  required,
  label,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  label?: string;
}) {
  const initialDigits = useMemo(() => {
    if (!defaultValue) return "";
    const m = defaultValue.match(/^\+?591(\d*)/);
    if (m) return m[1]!.slice(0, 8);
    return defaultValue.replace(/\D/g, "").slice(-8);
  }, [defaultValue]);

  const [digits, setDigits] = useState(initialDigits);
  const full = digits ? `+591${digits}` : "";

  return (
    <label className="block">
      {label && (
        <span className="text-xs font-medium text-[color:var(--muted)]">
          {label}
          {required && (
            <span className="ml-0.5 text-[color:var(--color-tomato-500)]">*</span>
          )}
        </span>
      )}
      <div
        className={`mt-1 flex items-center overflow-hidden rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] focus-within:border-[color:var(--color-amber-400)]`}
      >
        <span
          aria-hidden
          className="select-none border-r border-[color:var(--line)] bg-[color:var(--card-soft)] px-3 py-2 text-sm font-medium text-[color:var(--fg-soft)]"
        >
          +591
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          // Solo dígitos, máx 8 (celulares bolivianos).
          value={digits}
          onChange={(e) =>
            setDigits(e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          placeholder={placeholder ?? "72345678"}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none num-tabular"
        />
      </div>
      {/* Valor real que llega al form: +591XXXXXXXX (o vacío si no tipeó). */}
      <input type="hidden" name={name} value={full} />
      {error && (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
