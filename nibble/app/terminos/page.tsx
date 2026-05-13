import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/Header";
import { MarketingFooter } from "@/components/marketing/Footer";
import {
  isLegalEntityComplete,
  legalEntityName,
  legalEntityAddress,
} from "@/lib/legal/entity";

export const metadata = {
  title: "Términos y condiciones · Madriguera Shop",
};

const LAST_UPDATED = "6 de mayo de 2026";

export default function TerminosPage() {
  const complete = isLegalEntityComplete();
  return (
    <>
      <MarketingHeader />

      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Documento legal
        </p>
        <h1 className="font-display mt-3 text-4xl md:text-5xl">
          Términos y Condiciones
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Última actualización: {LAST_UPDATED}
        </p>

        {!complete && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-[color:var(--color-tomato-500)]/40 bg-[color:var(--color-tomato-500)]/10 p-4 text-sm text-[color:var(--color-tomato-700)]"
          >
            <strong className="font-semibold">Borrador no vigente.</strong>{" "}
            Este documento aún no tiene los datos legales de la entidad
            operadora. No tiene validez jurídica hasta que se completen las
            variables <code>LEGAL_ENTITY_NAME</code> y{" "}
            <code>LEGAL_ENTITY_ADDRESS</code>.
          </div>
        )}

        <div className="prose prose-stone mt-10 max-w-none text-[color:var(--fg-soft)] [&_h2]:font-display [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[color:var(--fg)] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[color:var(--fg)] [&_p]:my-3 [&_p]:leading-relaxed [&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1 [&_a]:text-[color:var(--fg)] [&_a]:underline [&_a]:decoration-[color:var(--color-amber-300)] [&_a]:underline-offset-2">
          <h2>1. Aceptación de los términos</h2>
          <p>
            Al usar Madriguera Shop (&ldquo;la plataforma&rdquo;), aceptas estos términos.
            Si no estás de acuerdo con alguna parte, no puedes usar el servicio.
          </p>

          <h2>2. Quién es Madriguera Shop</h2>
          <p>
            Madriguera Shop es una plataforma SaaS que permite a comerciantes en Bolivia
            crear su tienda virtual, recibir pedidos por WhatsApp y aceptar
            pagos mediante QR del banco. La operación está a cargo de{" "}
            {legalEntityName()}, con domicilio en {legalEntityAddress()}.
          </p>

          <h2>3. Cuenta y registro</h2>
          <p>
            Para usar el servicio debes crear una cuenta proporcionando datos
            verídicos. Eres responsable de la confidencialidad de tu contraseña
            y de toda la actividad realizada en tu cuenta.
          </p>
          <ul>
            <li>Debes tener al menos 18 años o la mayoría de edad legal aplicable.</li>
            <li>Eres responsable del contenido que subes a tu tienda (productos, imágenes, descripciones).</li>
            <li>Está prohibido suplantar a otra persona o crear cuentas con información falsa.</li>
          </ul>

          <h2>4. Plan, facturación y pagos</h2>
          <p>
            Madriguera Shop cobra una suscripción mensual o anual según el plan elegido.
            Los precios se muestran en bolivianos (Bs) e incluyen los impuestos
            aplicables.
          </p>
          <ul>
            <li><strong>Sin período de prueba</strong>: la primera factura se emite al momento del registro. La tienda queda activa apenas verificamos el primer pago.</li>
            <li><strong>Forma de pago</strong>: el dueño de la tienda paga mediante QR bancario y sube el comprobante. Verificamos manualmente en máximo 24 horas hábiles.</li>
            <li><strong>Mora</strong>: si la factura no se paga en los días posteriores al vencimiento, la tienda pasa a estado &ldquo;pago atrasado&rdquo; y luego puede ser suspendida.</li>
            <li><strong>Sin reembolsos</strong>: los pagos son por anticipado del período. Si cancelas, mantienes el acceso hasta el fin del período pagado pero no se reembolsa proporcionalmente.</li>
          </ul>

          <h2>5. Cancelación</h2>
          <p>
            Puedes cancelar tu suscripción en cualquier momento desde tu panel
            de facturación o escribiendo a soporte. La cancelación es efectiva
            al final del período facturado: mantienes el acceso completo hasta
            esa fecha y después no se generan nuevas facturas.
          </p>

          <h2>6. Uso aceptable</h2>
          <p>Está prohibido:</p>
          <ul>
            <li>Vender productos o servicios ilegales en Bolivia.</li>
            <li>Recolectar datos de otros usuarios sin consentimiento.</li>
            <li>Atacar la integridad de la plataforma (spam, scraping masivo, exploits).</li>
            <li>Suplantar identidad o usar la plataforma para estafas.</li>
          </ul>
          <p>
            Nos reservamos el derecho de suspender cuentas que violen estas
            reglas, sin previo aviso si la situación lo amerita.
          </p>

          <h2>7. Contenido del comerciante</h2>
          <p>
            Eres dueño del contenido que subes (productos, imágenes, datos de
            tu marca). Al subirlo a Madriguera Shop nos otorgas una licencia para
            mostrarlo en tu tienda y, si lo autorizas, en el directorio
            público de tiendas.
          </p>

          <h2>8. Relación con tus clientes</h2>
          <p>
            Cuando un cliente final compra en tu tienda, el contrato de venta
            es <strong>entre tú y ese cliente</strong>. Madriguera Shop no es parte de
            esa transacción. Eres responsable de:
          </p>
          <ul>
            <li>Cumplir con el pedido en los términos prometidos.</li>
            <li>Atender reclamos y devoluciones.</li>
            <li>Emitir facturas o comprobantes según la normativa boliviana aplicable.</li>
          </ul>

          <h2>9. Disponibilidad y soporte</h2>
          <p>
            Hacemos lo posible por mantener la plataforma operativa 24/7,
            pero no garantizamos cero downtime. Anunciamos mantenimientos
            programados con al menos 24 hs de anticipación.
          </p>
          <p>
            Soporte por WhatsApp en horario hábil (lunes a viernes,
            9:00–18:00). Para emergencias fuera de horario, deja tu mensaje y
            respondemos al siguiente día hábil.
          </p>

          <h2>10. Limitación de responsabilidad</h2>
          <p>
            Madriguera Shop no se hace responsable por pérdidas de ingreso, daños
            indirectos o consecuentes derivados del uso de la plataforma. La
            responsabilidad máxima en cualquier caso queda limitada al monto
            pagado por el comerciante en los últimos 3 meses.
          </p>

          <h2>11. Cambios en los términos</h2>
          <p>
            Podemos actualizar estos términos. Te avisamos por email a la
            dirección registrada con al menos 15 días de anticipación. Si sigues
            usando Madriguera Shop después de ese plazo, asumimos que aceptas los nuevos términos.
          </p>

          <h2>12. Ley aplicable y jurisdicción</h2>
          <p>
            Estos términos se rigen por la ley boliviana. Cualquier disputa
            será resuelta por los tribunales competentes de Cochabamba, Bolivia.
          </p>

          <h2>13. Contacto</h2>
          <p>
            ¿Dudas? Escríbenos a{" "}
            <Link href="https://wa.me/59172201700">+591 7220 1700</Link> o por email a soporte@madrigueras.shop.
          </p>

          <hr className="my-10 border-[color:var(--line)]" />

          <p className="text-xs text-[color:var(--muted)]">
            <span aria-hidden="true">⚠ </span>
            <span className="sr-only">Advertencia: </span>
            Este documento es un borrador genérico. Antes del lanzamiento
            público, debe ser revisado por un abogado local y completado con
            datos reales de la empresa (nombre legal, NIT, domicilio).
          </p>
        </div>
      </main>

      <MarketingFooter />
    </>
  );
}
