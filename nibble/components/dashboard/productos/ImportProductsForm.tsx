"use client";

import { useActionState, useRef, useState } from "react";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import {
  importProductsAction,
  type ImportProductsState,
} from "@/server/actions/import-products";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ImportProductsState = {};

export function ImportProductsForm() {
  const [state, action] = useActionState(importProductsAction, initial);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="space-y-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Archivo CSV</span>
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[color:var(--line-strong)] bg-[color:var(--card)] p-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm font-medium hover:border-[color:var(--color-bark-300)]"
          >
            <Upload className="size-4" />
            Elegir archivo
          </button>
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
          {fileName ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <FileText className="size-4 text-[color:var(--color-amber-600)]" />
              {fileName}
            </span>
          ) : (
            <span className="text-sm text-[color:var(--muted)]">
              Sin archivo seleccionado
            </span>
          )}
        </div>
        <p className="text-xs text-[color:var(--muted)]">
          Máx 2 MB. Hasta 1000 filas por import.
        </p>
      </label>

      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      {state.ok && (
        <div className="rounded-xl border border-[color:var(--color-leaf-500)]/30 bg-[color:var(--color-leaf-500)]/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-leaf-700)]">
            <CheckCircle2 className="size-4" />
            Import terminado
          </div>
          <p className="mt-2 text-sm">
            <strong>{state.created}</strong> productos creados ·{" "}
            <strong>{state.skipped}</strong> omitidos
          </p>
          {state.errors && state.errors.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-[color:var(--color-amber-700)] hover:underline">
                {state.errors.length} errores — ver detalle
              </summary>
              <ul className="mt-2 max-h-60 space-y-0.5 overflow-y-auto rounded-lg bg-[color:var(--bg)] p-2 font-mono text-[11px]">
                {state.errors.map((e, i) => (
                  <li key={i}>
                    Línea {e.line}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <SubmitButton pendingLabel="Importando…" disabled={!fileName}>
        Importar productos
      </SubmitButton>
    </form>
  );
}
