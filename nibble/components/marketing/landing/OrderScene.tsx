import { BellRing, Check, MapPin, QrCode } from "lucide-react";

/*
 * Escena del hero: así le llegan los pedidos al dueño. Es ilustrativa
 * (productos y precios de la tienda demo Big Bite Wings, clientes
 * inventados) y se anima solo con CSS (`.mk-scene-*` en globals.css),
 * sin JavaScript. Con movimiento reducido se muestra el estado final.
 */

type SceneOrder = {
  number: number;
  customer: string;
  items: string;
  zone: string;
  total: number;
  className: string;
};

const ORDERS: SceneOrder[] = [
  {
    number: 1245,
    customer: "Ana Salazar",
    items: "2× Buffalo Hot",
    zone: "Recoleta",
    total: 76,
    className: "mk-scene-1",
  },
  {
    number: 1246,
    customer: "Diego Rojas",
    items: "Wings Clásicos BBQ + Buffalo Hot",
    zone: "Sarco",
    total: 73,
    className: "mk-scene-2",
  },
  {
    number: 1247,
    customer: "Carla Mendoza",
    items: "Combo Familiar",
    zone: "Cala Cala",
    total: 145,
    className: "mk-scene-3",
  },
];

const bob = (n: number) => `Bs ${n.toLocaleString("es-BO")}`;

export function OrderScene() {
  return (
    <figure
      aria-label="Ejemplo: tres pedidos llegan al teléfono del dueño y se confirma un pago por QR."
      className="relative mx-auto w-full max-w-[22rem]"
    >
      <div aria-hidden="true">
        {/* Halo de color detrás del teléfono */}
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(212,20,90,0.45),transparent)] blur-2xl" />
        
        {/* Teléfono */}
        <div className="relative rounded-[2.6rem] border-[10px] border-mk-ink-3 bg-mk-ink-2 shadow-[0_40px_80px_-24px_rgba(0,0,0,0.65)]">
          <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-black/70" />

          <div className="flex items-center gap-3 border-b border-white/10 px-5 pb-4 pt-10">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#dc2626] text-[13px] font-bold text-white">
              BB
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mk-on-ink">Big Bite Wings</p>
              <p className="text-xs text-mk-on-ink-soft">Pedidos de tu tienda</p>
            </div>
            <span className="relative ml-auto grid size-9 place-items-center rounded-full bg-white/10 text-mk-saffron">
              <span className="mk-scene-ring absolute inset-0 rounded-full border-2 border-mk-saffron" />
              <BellRing className="size-4" />
            </span>
          </div>

          <ol className="flex min-h-[25rem] flex-col gap-3 px-4 py-5">
            {ORDERS.map((o) => (
              <li
                key={o.number}
                className={`${o.className} rounded-2xl bg-white p-3.5 text-mk-ink shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-mk-muted num-tabular">
                    Pedido #{o.number}
                  </span>
                  <span className="rounded-full bg-mk-saffron/25 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    Nuevo
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-snug">{o.items}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-mk-muted">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">
                      {o.customer} · {o.zone}
                    </span>
                  </span>
                  <span className="mk-display-wide text-base font-semibold text-mk-ink num-tabular">
                    {bob(o.total)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Pago confirmado, flotando fuera del teléfono */}
        <div className="mk-scene-pay absolute -bottom-7 -right-3 flex items-center gap-3 rounded-2xl bg-white py-3 pl-3 pr-4 text-mk-ink shadow-[0_24px_48px_-16px_rgba(0,0,0,0.55)] sm:-right-10">
          <span className="grid size-10 place-items-center rounded-xl bg-mk-leaf text-white">
            <QrCode className="size-5" />
          </span>
          <div>
            <p className="flex items-center gap-1 text-sm font-semibold">
              Pago por QR <Check className="size-4 text-mk-leaf" />
            </p>
            <p className="text-xs text-mk-muted num-tabular">Comprobante · Bs 145</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
