"use client";

import { useState, type ReactNode } from "react";

type TabKey = "banners" | "popups" | "cupones";

/**
 * Tabs sticky para los 3 tipos de promo. Vive como Client porque
 * intercambia paneles sin recargar la página — el dashboard `/promociones`
 * no necesita route per tab.
 *
 * Si en el futuro quieres URL-bookmark por tab, pásalo a un query param
 * (`?tab=popups`) y leelo desde el RSC. Hoy con un useState alcanza.
 */
export function PromocionesTabs({
  banners,
  popups,
  coupons,
  counts,
}: {
  banners: ReactNode;
  popups: ReactNode;
  coupons: ReactNode;
  counts: { banners: number; popups: number; coupons: number };
}) {
  const [tab, setTab] = useState<TabKey>("banners");

  return (
    <div>
      <div className="mt-6 flex flex-wrap gap-2 border-b border-[color:var(--line)]">
        <TabButton
          active={tab === "banners"}
          count={counts.banners}
          onClick={() => setTab("banners")}
        >
          Banners
        </TabButton>
        <TabButton
          active={tab === "popups"}
          count={counts.popups}
          onClick={() => setTab("popups")}
        >
          Popups
        </TabButton>
        <TabButton
          active={tab === "cupones"}
          count={counts.coupons}
          onClick={() => setTab("cupones")}
        >
          Cupones
        </TabButton>
      </div>

      <div className="mt-6">
        {tab === "banners" && banners}
        {tab === "popups" && popups}
        {tab === "cupones" && coupons}
      </div>
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-[color:var(--color-bark-900)] text-[color:var(--fg)]"
          : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--fg)]"
      }`}
    >
      {children}
      {count > 0 && (
        <span
          className={`num-tabular rounded-full px-1.5 text-[11px] ${
            active
              ? "bg-[color:var(--color-bark-900)] text-white"
              : "bg-[color:var(--bg)] text-[color:var(--muted)]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
