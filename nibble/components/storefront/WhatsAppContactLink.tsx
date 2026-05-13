"use client";

import { MessageCircle } from "lucide-react";
import { markWhatsAppOpened } from "@/server/actions/orders";

/**
 * Link al WhatsApp del comercio que también dispara `markWhatsAppOpened`
 * para registrar la conversión (cuántos clientes realmente abrieron el chat).
 *
 * El click NO bloquea la navegación a wa.me: usamos `void ...catch(...)` para
 * que el fetch al server action quede en background. Si la métrica falla,
 * el cliente aún puede llamar a la tienda.
 */
export function WhatsAppContactLink({
  storeSlug,
  trackingToken,
  phoneOnly,
  label,
  className,
}: {
  storeSlug: string;
  trackingToken: string;
  phoneOnly: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/${phoneOnly}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        // Fire-and-forget — no bloquea ni revierte el click.
        void markWhatsAppOpened(storeSlug, trackingToken).catch(() => {
          // El action ya loggea internamente; silenciamos aquí.
        });
      }}
    >
      <MessageCircle className="size-4" />
      {label}
    </a>
  );
}
