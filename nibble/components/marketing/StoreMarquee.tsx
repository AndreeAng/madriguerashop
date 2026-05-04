import { stores } from "@/lib/mock/stores";

export function StoreMarquee() {
  // Duplicate to make the loop seamless (animate-marquee shifts by -50%).
  const row = [...stores, ...stores];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="animate-marquee flex w-max gap-3">
        {row.map((s, i) => (
          <div
            key={`${s.slug}-${i}`}
            className="group flex shrink-0 items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] py-2.5 pl-2.5 pr-4"
          >
            <div
              className="grid size-9 place-items-center rounded-lg text-[11px] font-bold text-white shadow-sm"
              style={{ background: s.primaryColor }}
            >
              {s.logoEmoji}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-[11px] text-[color:var(--muted)]">
                {s.city} · {s.ordersThisMonth} pedidos/mes
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
