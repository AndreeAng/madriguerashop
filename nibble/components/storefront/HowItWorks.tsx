import { ShoppingBag, MessageCircle, Bike } from "lucide-react";

const steps = [
  {
    icon: ShoppingBag,
    label: "Elegís",
    desc: "Armás tu pedido en 2 minutos. Variantes, notas para la cocina, todo desde el menú.",
  },
  {
    icon: MessageCircle,
    label: "Confirmamos",
    desc: "Te contactamos por WhatsApp en menos de 5 minutos para validar tu orden.",
  },
  {
    icon: Bike,
    label: "Recibís",
    desc: "Llega caliente a tu puerta entre 25 y 35 minutos. Pagás QR, transfer o efectivo.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-label="Cómo funciona"
      className="mx-auto mt-14 max-w-6xl px-4"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-leaf-500)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-leaf-600)]">
            Cómo funciona
          </span>
          <h2 className="font-display mt-3 text-2xl leading-tight md:text-3xl">
            Tu pedido en <span className="underline-amber">tres pasos</span>
          </h2>
        </div>
      </div>

      <ol className="relative mt-7 grid gap-3 md:grid-cols-3 md:gap-5">
        <span
          aria-hidden
          className="absolute left-12 top-9 hidden h-px w-[calc(100%-6rem)] bg-gradient-to-r from-transparent via-[color:var(--color-amber-300)] to-transparent md:block"
        />
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.label}
              className="relative rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-5 shadow-card md:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--color-amber-50)] text-[color:var(--color-amber-700)] ring-1 ring-[color:var(--color-amber-200)]">
                  <Icon className="size-5" strokeWidth={2.2} />
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[color:var(--color-bark-900)] text-[10px] font-bold text-white num-tabular">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display text-lg leading-tight">{step.label}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted)]">
                {step.desc}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
