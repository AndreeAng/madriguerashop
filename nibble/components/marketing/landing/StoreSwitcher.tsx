"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUpRight,
  Beef,
  CalendarClock,
  Coffee,
  Cookie,
  Drill,
  Drumstick,
  Flame,
  MapPin,
  Paintbrush,
  Plus,
  Sandwich,
  Scissors,
  ShoppingBag,
  Sparkles,
  Wheat,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { storeActionColors } from "@/lib/storefront/theme";

/*
 * Demo de rubros: el mismo teléfono cambia de tienda según el rubro. Los
 * datos son los de las tiendas demo del seed (nombre, color, productos y
 * precios), así que lo que se ve aquí es lo que el visitante encuentra al
 * abrir "Ver en vivo". Los colores de acción salen de `storeActionColors`,
 * igual que en la tienda real.
 */

type Vertical = {
  key: string;
  label: string;
  pitch: string;
  slug: string;
  name: string;
  initials: string;
  color: string;
  note: string;
  noteIcon: LucideIcon;
  chips: string[];
  products: { name: string; price: number; icon: LucideIcon }[];
  action: "Agregar" | "Reservar";
};

const VERTICALS: Vertical[] = [
  {
    key: "restaurante",
    label: "Restaurantes",
    pitch: "Menú con horarios, modificadores y combos.",
    slug: "big-bite-wings",
    name: "Big Bite Wings",
    initials: "BB",
    color: "#dc2626",
    note: "Delivery o recojo en Cochabamba",
    noteIcon: MapPin,
    chips: ["Wings", "Combos", "Bebidas"],
    products: [
      { name: "Wings Clásicos BBQ", price: 35, icon: Drumstick },
      { name: "Combo Familiar", price: 145, icon: Flame },
      { name: "Buffalo Hot", price: 38, icon: Drumstick },
    ],
    action: "Agregar",
  },
  {
    key: "food-truck",
    label: "Food trucks",
    pitch: "Ubicación del día y promo destacada.",
    slug: "la-latita",
    name: "La Latita",
    initials: "LL",
    color: "#d97706",
    note: "Jueves en El Prado · Sábados en La Recoleta",
    noteIcon: MapPin,
    chips: ["Smash", "Papas", "Bebidas"],
    products: [
      { name: "Smash Clásica", price: 38, icon: Sandwich },
      { name: "Doble Cheese", price: 45, icon: Beef },
      { name: "BBQ Bacon", price: 48, icon: Sandwich },
    ],
    action: "Agregar",
  },
  {
    key: "retail",
    label: "Retail",
    pitch: "Catálogo con stock, variantes y combos.",
    slug: "nutriarte",
    name: "Nutriarte",
    initials: "NU",
    color: "#15803d",
    note: "Hecho en Cochabamba con ingredientes locales",
    noteIcon: Sparkles,
    chips: ["Granolas", "Snacks", "Combos"],
    products: [
      { name: "Granola Coco & Almendra", price: 65, icon: Wheat },
      { name: "Granola Cacao Puro", price: 72, icon: Cookie },
      { name: "Combo Desayuno Saludable", price: 135, icon: Coffee },
    ],
    action: "Agregar",
  },
  {
    key: "ferreteria",
    label: "Ferreterías",
    pitch: "SKU, stock visible y cotización por WhatsApp.",
    slug: "ferreteria-tunari",
    name: "Ferretería Tunari",
    initials: "FT",
    color: "#92400e",
    note: "Para maestros, contratistas y particulares",
    noteIcon: Wrench,
    chips: ["Herramientas", "Construcción", "Pintura"],
    products: [
      { name: "Taladro percutor Bosch GSB 13 RE", price: 680, icon: Drill },
      { name: "Amoladora angular Makita 115mm", price: 520, icon: Wrench },
      { name: "Juego de llaves Stanley (10 piezas)", price: 220, icon: Wrench },
    ],
    action: "Agregar",
  },
  {
    key: "servicios",
    label: "Servicios",
    pitch: "Reservas a tu hora, sin vender productos.",
    slug: "estudio-clara",
    name: "Estudio Clara",
    initials: "EC",
    color: "#be185d",
    note: "Reservas por WhatsApp, te atendemos a tu hora",
    noteIcon: CalendarClock,
    chips: ["Cabello", "Estética", "Color"],
    products: [
      { name: "Corte + lavado + secado", price: 120, icon: Scissors },
      { name: "Limpieza facial profunda", price: 180, icon: Sparkles },
      { name: "Color completo", price: 350, icon: Paintbrush },
    ],
    action: "Reservar",
  },
];

const bob = (n: number) => `Bs ${n.toLocaleString("es-BO")}`;

export function StoreSwitcher() {
  const [index, setIndex] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const v = VERTICALS[index]!;
  const { action, onAction } = storeActionColors(v.color);
  const NoteIcon = v.noteIcon;

  // Patrón de pestañas WAI-ARIA: flechas mueven el foco y activan.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const last = VERTICALS.length - 1;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? last
          : e.key === "ArrowDown" || e.key === "ArrowRight"
            ? (index + 1) % VERTICALS.length
            : (index - 1 + VERTICALS.length) % VERTICALS.length;
    setIndex(next);
    tabsRef.current[next]?.focus();
  };

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
      <div
        role="tablist"
        aria-label="Rubros"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="flex flex-col"
      >
        {VERTICALS.map((item, i) => {
          const selected = i === index;
          return (
            <button
              key={item.key}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setIndex(i)}
              className={`group relative flex min-h-11 items-baseline gap-5 border-t border-[color:var(--line)] py-5 text-left transition-colors duration-300 last:border-b ${
                selected ? "text-mk-ink" : "text-mk-muted hover:text-mk-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-2 size-3 shrink-0 self-start rounded-full transition-transform duration-300"
                style={{
                  background: item.color,
                  transform: selected ? "scale(1)" : "scale(0.55)",
                  opacity: selected ? 1 : 0.5,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="mk-display block text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-none">
                  {item.label}
                </span>
                <span
                  className={`mt-2 block text-sm transition-opacity duration-300 md:text-base ${
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-70 max-lg:hidden"
                  }`}
                >
                  {item.pitch}
                </span>
              </span>
              <span className="hidden shrink-0 text-sm font-medium text-mk-muted md:block">
                {item.name}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${v.key}`}
        className="relative mx-auto w-full max-w-[22rem]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-30 blur-3xl transition-colors duration-500"
          style={{ background: v.color }}
        />

        {/* Teléfono con la tienda del rubro elegido */}
        <div className="overflow-hidden rounded-[2.6rem] border-[10px] border-mk-ink bg-white shadow-[0_40px_80px_-30px_rgba(18,16,22,0.55)]">
          <div key={v.key} className="mk-swap">
            <div
              className="relative px-5 pb-5 pt-9 transition-colors duration-500"
              style={{ background: action, color: onAction }}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/90 text-sm font-bold text-mk-ink">
                  {v.initials}
                </span>
                <div className="min-w-0">
                  <p className="mk-display-wide truncate text-xl font-semibold">{v.name}</p>
                  <p className="flex items-center gap-1 text-xs">
                    <NoteIcon aria-hidden="true" className="size-3 shrink-0" />
                    <span className="truncate">{v.note}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 overflow-hidden px-5 pt-4">
              {v.chips.map((c, i) => (
                <span
                  key={c}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    i === 0 ? "" : "border border-[color:var(--line-strong)] text-mk-soft"
                  }`}
                  style={i === 0 ? { background: action, color: onAction } : undefined}
                >
                  {c}
                </span>
              ))}
            </div>

            <ul className="space-y-2.5 px-5 py-4">
              {v.products.map((p) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.name}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] p-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-12 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${v.color}1f`, color: v.color }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug text-mk-ink">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-mk-soft num-tabular">
                        {bob(p.price)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-full"
                      style={{ background: action, color: onAction }}
                      title={v.action}
                    >
                      <Plus className="size-4" />
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 pb-6">
              <div
                className="flex items-center justify-between rounded-full px-5 py-3.5 text-sm font-semibold"
                style={{ background: "var(--color-mk-ink)", color: "white" }}
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag aria-hidden="true" className="size-4" />
                  {v.action === "Reservar" ? "Tu reserva" : "Tu pedido"}
                </span>
                <span className="num-tabular">{bob(v.products[0]!.price)}</span>
              </div>
            </div>
          </div>
        </div>

        <Link
          href={`/${v.slug}`}
          className="group mx-auto mt-6 flex min-h-11 w-fit items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-mk-ink underline decoration-2 underline-offset-4 transition-colors hover:text-mk-magenta"
          style={{ textDecorationColor: v.color }}
        >
          Ver {v.name} en vivo
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}
