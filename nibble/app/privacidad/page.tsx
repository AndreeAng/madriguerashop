import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";
import {
  isLegalEntityComplete,
  legalEntityName,
  legalEntityAddress,
} from "@/lib/legal/entity";

export const metadata = {
  title: "Política de privacidad · Madriguera Shop",
};

const LAST_UPDATED = "6 de mayo de 2026";

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" updated={LAST_UPDATED} complete={isLegalEntityComplete()}>
      <p>
        En Madriguera Shop respetamos tu privacidad y la de tus clientes. Esta
        política explica qué datos recolectamos, cómo los usamos, con quién
        los compartimos y qué derechos tienes.
      </p>

      <h2>1. Quiénes somos</h2>
      <p>
        Madriguera Shop es operado por {legalEntityName()}, con domicilio
        en {legalEntityAddress()}. Para cualquier tema relacionado con
        datos personales, escríbenos a{" "}
        <Link href="mailto:privacidad@madrigueras.shop">privacidad@madrigueras.shop</Link>.
      </p>

      <h2>2. Qué datos recolectamos</h2>

      <h3>De los comerciantes (dueños de tienda)</h3>
      <ul>
        <li>Nombre completo</li>
        <li>Email y/o teléfono (usado como identificador de cuenta)</li>
        <li>Información de la tienda (nombre, dirección, redes)</li>
        <li>Imágenes que subes (logo, banner, productos, comprobantes de pago)</li>
        <li>Historial de pagos a Madriguera Shop</li>
        <li>Logs técnicos (IP, navegador) para auditoría y seguridad</li>
      </ul>

      <h3>De los clientes finales (compradores)</h3>
      <ul>
        <li>Nombre completo</li>
        <li>Teléfono</li>
        <li>Email (opcional)</li>
        <li>Dirección de entrega</li>
        <li>Historial de pedidos</li>
        <li>Comprobantes de pago QR (si los suben)</li>
        <li>IP y navegador para prevención de abuso</li>
      </ul>

      <h2>3. Cómo usamos tus datos</h2>
      <ul>
        <li>Para proveer el servicio: crear tu cuenta, mostrarte tu tienda, procesar pedidos.</li>
        <li>Para facturarte el plan mensual y verificar pagos.</li>
        <li>Para comunicarnos contigo: emails transaccionales (factura emitida, pedido nuevo, recovery de contraseña).</li>
        <li>Para mejorar el producto: análisis agregado y anonimizado del uso de la plataforma.</li>
        <li>Para detectar fraude y abuso (rate limit, AuditLog).</li>
      </ul>
      <p>
        <strong>No vendemos tus datos.</strong> Punto.
      </p>

      <h2>4. Con quién compartimos datos</h2>
      <ul>
        <li>
          <strong>Comerciante ↔ cliente final</strong>: cuando un cliente
          hace un pedido en tu tienda, tú como dueño ves su nombre,
          teléfono y dirección — necesario para entregar el pedido.
        </li>
        <li>
          <strong>Proveedores de infraestructura</strong>: hosting (proveedor
          cloud), email (proveedor SMTP), almacenamiento de imágenes. Sólo
          acceden a lo necesario para operar.
        </li>
        <li>
          <strong>Autoridades</strong>: si una orden judicial nos lo exige.
          Te avisamos antes salvo que la ley lo prohíba.
        </li>
      </ul>

      <h2>5. Cookies y tecnologías similares</h2>
      <p>
        Usamos cookies estrictamente funcionales:
      </p>
      <ul>
        <li><strong>Sesión</strong>: para mantenerte autenticado.</li>
        <li><strong>Carrito guest</strong>: para que no pierdas tus items entre páginas.</li>
        <li><strong>CSRF</strong>: para proteger los formularios.</li>
      </ul>
      <p>
        No usamos cookies de tracking ni publicidad de terceros (Google
        Ads, Facebook Pixel) sin tu consentimiento explícito.
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        En cualquier momento puedes:
      </p>
      <ul>
        <li><strong>Acceder</strong> a tus datos: pedimos email a privacidad@madrigueras.shop y te enviamos una copia.</li>
        <li><strong>Corregir</strong> datos: directamente desde tu panel o pidiéndolo a soporte.</li>
        <li><strong>Eliminar</strong> tu cuenta: cancelas la suscripción y pides borrado total. Conservamos sólo lo legalmente requerido (facturas) por el tiempo mínimo aplicable.</li>
        <li><strong>Portabilidad</strong>: te exportamos tus pedidos y catálogo en formato CSV.</li>
        <li><strong>Oposición</strong>: puedes oponerte a comunicaciones no esenciales (newsletters); las transaccionales no son opt-out porque son parte del servicio.</li>
      </ul>

      <h2>7. Seguridad</h2>
      <ul>
        <li>Contraseñas hasheadas con bcrypt.</li>
        <li>Sesiones JWT con expiración.</li>
        <li>Rate limiting contra brute force.</li>
        <li>Validación server-side de toda la entrada del usuario.</li>
        <li>Logs de auditoría sobre acciones sensibles.</li>
        <li>Conexiones HTTPS obligatorias en producción.</li>
      </ul>
      <p>
        Si descubres una vulnerabilidad, escríbenos a{" "}
        <Link href="mailto:security@madrigueras.shop">security@madrigueras.shop</Link>.
        Agradecemos los reportes responsables.
      </p>

      <h2>8. Retención</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa. Después de
        cancelar, mantenemos lo siguiente por el tiempo mínimo legal:
      </p>
      <ul>
        <li>Facturas y registros contables: 5 años (normativa tributaria boliviana).</li>
        <li>Logs de auditoría: 12 meses.</li>
        <li>Backups: rotados cada 30 días.</li>
      </ul>

      <h2>9. Datos de menores</h2>
      <p>
        Madriguera Shop no está dirigido a menores de 18 años. Si descubrimos que
        recolectamos datos de un menor sin consentimiento parental, los
        eliminamos inmediatamente.
      </p>

      <h2>10. Cambios a esta política</h2>
      <p>
        Si hacemos cambios significativos, te avisamos por email con al
        menos 15 días de anticipación. Para cambios menores (correcciones
        de redacción), simplemente actualizamos esta página.
      </p>

      <h2>11. Marco legal</h2>
      <p>
        Cumplimos con la legislación boliviana aplicable, incluyendo la Ley
        164 de Telecomunicaciones, Tecnologías de Información y Comunicación
        y normativa de protección al consumidor.
      </p>

      <hr />

      <p className="rounded-2xl bg-mk-paper-2 p-5 text-sm">
        <strong>Advertencia:</strong> este documento es un borrador genérico. Antes del lanzamiento
        público, debe ser revisado por un abogado local y completado con
        datos reales de la empresa (nombre legal, NIT, domicilio).
      </p>
    </LegalPage>
  );
}
