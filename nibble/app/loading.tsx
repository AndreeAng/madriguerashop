export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[color:var(--bg)]">
      <div className="flex items-center gap-3 text-[color:var(--muted)]">
        <span className="size-2.5 animate-pulse-dot rounded-full bg-[color:var(--color-amber-500)]" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
          Cargando…
        </span>
      </div>
    </div>
  );
}
