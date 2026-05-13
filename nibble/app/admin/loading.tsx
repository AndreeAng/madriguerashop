/**
 * Skeleton del panel admin. Mismas dimensiones que las pages reales para
 * minimizar layout shift.
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen">
      {/* Mock del sidebar dark — solo el espacio, sin items */}
      <div className="hidden w-60 shrink-0 bg-[color:var(--color-bark-900)] md:block" />

      <main className="flex-1 p-6 lg:p-8">
        <div className="animate-pulse">
          <div className="h-3 w-24 rounded-full bg-[color:var(--line)]" />
          <div className="mt-2 h-8 w-72 max-w-full rounded-lg bg-[color:var(--line)]" />

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]"
              />
            ))}
          </div>

          <div className="mt-6 h-96 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]" />
        </div>
      </main>
    </div>
  );
}
