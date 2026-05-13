import Link from "next/link";

/**
 * Banner promocional arriba del menú del storefront. Recibe los datos ya
 * resueltos (server elige cuál está "live ahora") — la responsabilidad
 * de filtrar por fecha vive en el RSC que llama, no acá.
 *
 * Diseño minimal: imagen + texto opcional overlay. Clickable si tiene
 * `linkUrl`. La altura es responsiva: 240px en mobile, 320px en desktop.
 */
export function StorefrontBanner({
  imageUrl,
  mobileImageUrl,
  title,
  subtitle,
  linkUrl,
}: {
  imageUrl: string;
  mobileImageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
}) {
  const inner = (
    <div className="relative h-[180px] w-full overflow-hidden rounded-3xl md:h-[260px]">
      {/* Imagen mobile separada si el owner la subió; sino reusa la principal. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mobileImageUrl ?? imageUrl}
        alt={title ?? ""}
        className="absolute inset-0 size-full object-cover md:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={title ?? ""}
        className="absolute inset-0 hidden size-full object-cover md:block"
      />

      {/* Overlay solo si hay texto para mostrar. Sin texto, la imagen sola
          es la promo — algunos owners subirán el banner ya "diseñado". */}
      {(title || subtitle) && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-8">
            {title && (
              <h2 className="font-display text-xl leading-tight md:text-3xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-white/90 md:text-base">
                {subtitle}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (linkUrl) {
    // Link externo (https://) abre en nueva pestaña; interno (/) navega
    // dentro del storefront sin perder cookie de carrito.
    const isExternal = /^https?:\/\//.test(linkUrl);
    return (
      <Link
        href={linkUrl}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="block transition hover:opacity-95"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
