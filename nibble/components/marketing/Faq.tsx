import { Plus } from "lucide-react";

const FAQ = [
  {
    q: "¿De verdad arranco en 5 minutos?",
    a: "Sí. Subes tu logo, eliges el diseño que mejor calza con tu negocio, cargas 3 productos y compartes el link. Si necesitas migrar de otra plataforma, te lo hacemos nosotros sin costo en el plan anual.",
  },
  {
    q: "¿Cobran comisión por cada venta?",
    a: "Cero. Solo pagas los Bs 500/mes. La plata del cliente entra completa a tu QR — Nibble nunca toca tu dinero.",
  },
  {
    q: "¿Funciona con QR Simple del BCP, BNB, Ganadero…?",
    a: "Funciona con cualquier QR estático bancario boliviano. Subes el QR como imagen una sola vez y queda en tu checkout. El cliente paga, sube el comprobante, lo apruebas.",
  },
  {
    q: "¿Tengo que tener delivery propio?",
    a: "No es obligatorio. Puedes ofrecer solo retiro en local. Si haces delivery, dibujas tu zona en el mapa, defines tarifa por zona, y listo. Sin Excel.",
  },
  {
    q: "¿Puedo cambiar el diseño después?",
    a: "Lo cambias cuando quieras desde el panel. Tus productos, pedidos y clientes se quedan — solo cambia la cara.",
  },
  {
    q: "¿Cómo facturan? ¿Necesito NIT?",
    a: "Te emitimos factura electrónica con tu NIT cada mes. Si recién empiezas y no tienes NIT, te ayudamos a sacarlo gratis con un contador aliado en Cochabamba.",
  },
  {
    q: "¿Hay versión gratis o de prueba?",
    a: "No. Nibble es de pago desde el primer día — eso nos permite acompañarte de cerca y mantener el servicio rápido para todos. Si quieres ver cómo se ve, mira la tienda de muestra. Para más info, escríbenos por WhatsApp al +591 7220 1700.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)]">
      {FAQ.map((item, i) => (
        <details
          key={item.q}
          className="group p-6 transition-colors duration-200 ease-[var(--ease-out-quart)] open:bg-[color:var(--color-cream-50)]/50"
          {...(i === 0 ? { open: true } : {})}
        >
          <summary className="flex cursor-pointer items-start justify-between gap-4 list-none select-none active:scale-[0.997] transition-transform duration-150 ease-[var(--ease-out-quart)] [&::-webkit-details-marker]:hidden">
            <span className="text-base font-semibold md:text-lg">{item.q}</span>
            <Plus
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-[color:var(--muted)] transition-transform duration-200 ease-[var(--ease-out-quart)] group-open:rotate-45 group-open:text-[color:var(--fg)]"
            />
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[color:var(--muted)] animate-faq-reveal md:text-base">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
