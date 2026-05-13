/**
 * Skeleton del storefront. Layout amplio (hero alto + grid de productos)
 * para mantener la altura visual del menú real.
 */
export default function StorefrontLoading() {
  return (
    <div>
      {/* Header sticky placeholder */}
      <div className="sticky top-0 z-40 h-16 border-b border-[color:var(--line)] glass" />

      <main className="animate-pulse">
        {/* Hero */}
        <div className="relative h-[60vh] min-h-[440px] w-full bg-[color:var(--color-bark-900)]/40" />

        {/* Trust strip */}
        <div className="mx-auto mt-8 grid max-w-6xl gap-3 px-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)]"
            />
          ))}
        </div>

        {/* Featured */}
        <section className="mx-auto mt-10 max-w-6xl px-4">
          <div className="h-3 w-32 rounded-full bg-[color:var(--line)]" />
          <div className="mt-3 h-9 w-80 max-w-full rounded-lg bg-[color:var(--line)]" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 md:grid-rows-2">
            <div className="h-80 rounded-3xl bg-[color:var(--card)] md:row-span-2" />
            <div className="h-36 rounded-3xl bg-[color:var(--card)]" />
            <div className="h-36 rounded-3xl bg-[color:var(--card)]" />
          </div>
        </section>

        {/* Grid de productos */}
        <section className="mx-auto mt-12 max-w-6xl px-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]"
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
