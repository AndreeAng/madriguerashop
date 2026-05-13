/**
 * Skeleton compartido del dashboard. Se renderiza mientras el layout/page
 * fetchean datos en server. Mantiene la altura para evitar layout shift
 * cuando llega el contenido real.
 */
export default function DashboardLoading() {
  return (
    <main className="p-6 lg:p-8">
      <div className="animate-pulse">
        <div className="h-3 w-24 rounded-full bg-[color:var(--line)]" />
        <div className="mt-2 h-8 w-64 max-w-full rounded-lg bg-[color:var(--line)]" />
        <div className="mt-2 h-4 w-48 rounded-full bg-[color:var(--line)]" />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]"
            />
          ))}
        </div>

        <div className="mt-6 h-64 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]" />
      </div>
    </main>
  );
}
