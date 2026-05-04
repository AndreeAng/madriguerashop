import { Sparkles, Truck, Zap } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div
      role="region"
      aria-label="Promociones y avisos"
      className="relative overflow-hidden border-b border-[color:var(--color-bark-800)] bg-[color:var(--color-bark-900)] text-white"
    >
      <div className="grain-soft" aria-hidden />
      <div className="relative flex h-9 items-center">
        <div
          className="animate-marquee flex shrink-0 items-center gap-10 whitespace-nowrap pl-6 text-[12px] font-medium tracking-wide"
          aria-hidden="true"
        >
          <Item icon={<Truck className="size-3.5" />} text="Envío GRATIS sobre Bs 100" />
          <Item icon={<Zap className="size-3.5" />} text="Pedido caliente en 25–35 min" />
          <Item
            icon={<Sparkles className="size-3.5 text-[color:var(--color-amber-300)]" />}
            text="Combo del día con 20% off"
          />
          <Item icon={<Truck className="size-3.5" />} text="Envío GRATIS sobre Bs 100" />
          <Item icon={<Zap className="size-3.5" />} text="Pedido caliente en 25–35 min" />
          <Item
            icon={<Sparkles className="size-3.5 text-[color:var(--color-amber-300)]" />}
            text="Combo del día con 20% off"
          />
        </div>
        <div
          className="animate-marquee flex shrink-0 items-center gap-10 whitespace-nowrap pl-10 text-[12px] font-medium tracking-wide"
          aria-hidden="true"
        >
          <Item icon={<Truck className="size-3.5" />} text="Envío GRATIS sobre Bs 100" />
          <Item icon={<Zap className="size-3.5" />} text="Pedido caliente en 25–35 min" />
          <Item
            icon={<Sparkles className="size-3.5 text-[color:var(--color-amber-300)]" />}
            text="Combo del día con 20% off"
          />
          <Item icon={<Truck className="size-3.5" />} text="Envío GRATIS sobre Bs 100" />
          <Item icon={<Zap className="size-3.5" />} text="Pedido caliente en 25–35 min" />
          <Item
            icon={<Sparkles className="size-3.5 text-[color:var(--color-amber-300)]" />}
            text="Combo del día con 20% off"
          />
        </div>
      </div>
      <span className="sr-only">
        Envío gratis sobre Bs 100. Pedido caliente en 25 a 35 minutos. Combo del día con 20 por ciento de descuento.
      </span>
    </div>
  );
}

function Item({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span>{text}</span>
      <span className="text-white/30">•</span>
    </span>
  );
}
