import { Star, ShoppingBag, MessageCircle, MapPin } from "lucide-react";

/**
 * Editorial phone mock used in the hero.
 * No real phone chassis SVG — a soft rounded rectangle with the
 * storefront UI inside, tilted slightly so it reads as "a real screen".
 */
export function HeroPhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[340px] [perspective:1200px]">
      <div className="relative shadow-float rounded-[2.4rem] border border-[color:var(--line)] bg-[color:var(--card)] p-2 [transform:rotateY(-6deg)_rotateX(2deg)]">
        {/* speaker pill */}
        <div className="absolute left-1/2 top-3 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[color:var(--color-bark-900)]/80" />

        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#fff7ec] to-white">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pb-1 pt-5 text-[10px] font-medium text-[color:var(--color-bark-700)]">
            <span>09:41</span>
            <span className="font-semibold tracking-wider">madrigueras.shop/big-bite-wings</span>
            <span>5G</span>
          </div>

          {/* banner */}
          <div className="relative mx-3 mt-2 h-32 overflow-hidden rounded-2xl bg-[#3a1a1a]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#dc2626] via-[#7f1d1d] to-[#3a1a1a]" />
            <div className="absolute inset-0 grain opacity-[0.18]" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white text-xs font-bold text-[#dc2626]">
                BB
              </div>
            </div>
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-medium text-[color:var(--color-bark-900)]">
              <span className="size-1.5 rounded-full bg-[color:var(--color-leaf-500)] animate-pulse-dot" />
              Abierto
            </div>
          </div>

          {/* header info */}
          <div className="px-4 pt-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg leading-none">Big Bite Wings</h3>
                <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                  Wings que no te dejan parar · Cochabamba
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[color:var(--color-amber-50)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-amber-600)]">
                <Star className="size-3 fill-[color:var(--color-amber-400)] stroke-[color:var(--color-amber-400)]" />
                4.8
              </div>
            </div>

            {/* category chips */}
            <div className="mt-3 flex gap-1.5 overflow-hidden text-[10px]">
              {["Wings", "Combos", "Entradas", "Bebidas"].map((c, i) => (
                <span
                  key={c}
                  className={[
                    "rounded-full px-2.5 py-1 font-medium",
                    i === 0
                      ? "bg-[color:var(--color-bark-900)] text-white"
                      : "bg-[color:var(--color-bark-50)] text-[color:var(--color-bark-700)]",
                  ].join(" ")}
                >
                  {c}
                </span>
              ))}
            </div>

            {/* product row */}
            <div className="mt-3 space-y-2">
              <ProductRow
                emoji="🍗"
                name="Wings Clásicos BBQ"
                desc="12 piezas · BBQ ahumada"
                price="Bs 45"
                badge="Más vendido"
              />
              <ProductRow
                emoji="🌶️"
                name="Buffalo Hot"
                desc="Picante medio-alto"
                price="Bs 48"
              />
              <ProductRow
                emoji="🍟"
                name="Cheese Fries"
                desc="Cheddar + tocino"
                price="Bs 32"
              />
            </div>

            {/* sticky cart */}
            <div className="mt-3 mb-3 flex items-center justify-between rounded-xl bg-[color:var(--color-bark-900)] px-3 py-2.5 text-white">
              <span className="inline-flex items-center gap-2 text-xs">
                <ShoppingBag className="size-3.5" />
                <span className="font-medium">2 productos</span>
              </span>
              <span className="text-xs font-semibold">Pedir Bs 93 →</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating order toast */}
      <div className="animate-float absolute -right-6 top-16 hidden w-60 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 shadow-float md:block">
        <div className="flex items-center gap-2">
          <span className="relative flex size-7 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle className="size-3.5" />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#25D366] ring-2 ring-[color:var(--card)] animate-pulse-dot" />
          </span>
          <div className="text-[11px] font-semibold">Nuevo pedido · #1247</div>
        </div>
        <div className="mt-2 text-[11px] text-[color:var(--muted)]">
          Carla M. · 1× Combo Familiar
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-[color:var(--muted)]">
            <MapPin className="size-3" /> Cala Cala
          </span>
          <span className="font-semibold">Bs 145</span>
        </div>
      </div>

      {/* Floating QR confirmation */}
      <div className="animate-float absolute -left-8 bottom-10 hidden w-56 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 shadow-float [animation-delay:1.2s] md:block">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
            QR Simple
          </span>
          <span className="rounded-full bg-[color:var(--color-leaf-500)]/12 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-leaf-600)]">
            Pago aprobado
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div
            aria-hidden
            className="grid size-10 grid-cols-4 gap-px rounded-md bg-[color:var(--color-bark-900)] p-1"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="rounded-[1px] bg-white"
                style={{ opacity: (i * 53) % 7 < 3 ? 0 : 1 }}
              />
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold">Bs 145,00</div>
            <div className="text-[10px] text-[color:var(--muted)]">Comprobante #BCP-90412</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRow({
  emoji,
  name,
  desc,
  price,
  badge,
}: {
  emoji: string;
  name: string;
  desc: string;
  price: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-white p-2">
      <div className="grid size-10 place-items-center rounded-lg bg-[color:var(--color-cream-100)] text-lg">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold">{name}</span>
          {badge && (
            <span className="rounded-full bg-[color:var(--color-amber-100)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[color:var(--color-amber-600)]">
              {badge}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-[color:var(--muted)]">{desc}</p>
      </div>
      <span className="text-[11px] font-semibold">{price}</span>
    </div>
  );
}
