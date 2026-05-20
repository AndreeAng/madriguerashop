import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un monto en bolivianos. Acepta `number` o cualquier objeto con
 * `toNumber()` (Prisma `Decimal`) — los campos `@db.Decimal` del schema
 * llegan como Decimal, no como primitivo.
 */
export function formatBob(amount: number | { toNumber: () => number }): string {
  return `Bs ${formatBobAmount(amount)}`;
}

/** Como `formatBob` pero sin el prefijo "Bs " — para componer mensajes
 *  donde el "Bs" ya está fuera (ej. WhatsApp). */
export function formatBobAmount(amount: number | { toNumber: () => number }): string {
  const n = typeof amount === "number" ? amount : amount.toNumber();
  return n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formato corto "13/05/2026 14:32" para tablas y eventos del dashboard. */
export function formatDateTimeShort(d: Date): string {
  return d.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formato corto "13/05/2026" (sin hora). */
export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formato largo "lunes, 13 de mayo, 14:32" — para mensajes al cliente
 * (WhatsApp, email, página de tracking). Tiene weekday + mes nombrado:
 * más legible que el corto, más pesado visualmente.
 */
export function formatDateLong(d: Date): string {
  return d.toLocaleString("es-BO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formatea un número entero/decimal con separadores de miles es-BO.
 *  Para moneda, usar `formatBob`/`formatBobAmount` en su lugar. */
export function formatNumber(n: number): string {
  return n.toLocaleString("es-BO");
}

/** Construye un link `https://wa.me/<phone>?text=<encoded>` listo para
 *  abrirse desde el browser. Limpia caracteres no numéricos del phone
 *  y aplica `encodeURIComponent` al mensaje. Si el phone es null/undefined
 *  (tienda sin WhatsApp configurado), devuelve string vacío — los callers
 *  son responsables de no renderizar el link en ese caso. */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string {
  if (!phone) return "";
  return `https://wa.me/${formatWaPhone(phone)}?text=${encodeURIComponent(message)}`;
}

// `addDays` se exporta desde `lib/i18n/dates` para que las copias no se
// desincronicen entre módulos. Re-exportamos acá para no romper consumers
// existentes (billing) que importan desde `lib/utils`.
export { addDays } from "@/lib/i18n/dates";

/**
 * Limpia caracteres no numéricos de un teléfono para armar links wa.me.
 * Ej: "+591-72201700" → "59172201700".
 *
 * Acepta `null`/`undefined` y devuelve `""` para que callers que reciban
 * un teléfono opcional no tengan que null-guard antes de invocar. La UI
 * debe omitir el render del link/CTA cuando el resultado sea string vacío.
 */
export function formatWaPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Iniciales para avatares — toma las primeras 2 palabras del nombre y
 * devuelve sus iniciales en mayúsculas. Si no hay nombre, devuelve "·".
 *
 * Vive en `lib/utils.ts` (módulo neutro, sin "use client") para que server
 * components puedan invocarlo. Antes estaba exportado desde un archivo
 * `"use client"`, lo que hacía que Turbopack lo tratara como server-action
 * y rompiera al usarlo desde el server (ej. AdminSidebar RSC).
 */
export function nameToInitials(name: string | null | undefined): string {
  if (!name) return "·";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}
