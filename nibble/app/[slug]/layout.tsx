import { notFound } from "next/navigation";
import { getStorefrontData } from "@/lib/tenant/resolve";

/**
 * Layout del storefront — su única responsabilidad es validar la existencia
 * de la tienda y propagar el status 404 cuando no existe.
 *
 * # Por qué la validación vive en LAYOUT y no en page.tsx
 *
 * Hay un `app/[slug]/loading.tsx` que crea un Suspense boundary implícito
 * alrededor de los `children` del layout. Cuando la página llamaba a
 * `notFound()` desde dentro de su propio render, Next ya había empezado a
 * streamear el response con status 200 (con el skeleton del loading) — para
 * cuando `notFound()` se ejecutaba era tarde, el status quedaba 200 y solo
 * el body cambiaba al not-found.tsx.
 *
 * Resultado: el storefront servía 200 OK para slugs inexistentes →  Google
 * indexaba esas URLs como páginas válidas, contaminando el ranking del
 * dominio con páginas vacías ("Esta tienda no está disponible").
 *
 * Moviendo la validación al layout (que renderea ANTES de cualquier Suspense
 * boundary downstream), el `notFound()` corre antes de que el response
 * arranque y Next propaga el 404 correctamente. El skeleton sigue
 * funcionando para slugs válidos — solo cambiamos cuándo se decide si
 * mostrar la página o no.
 *
 * `getStorefrontData` está cacheada con `React.cache`, así que el page
 * downstream que también la llama no genera una segunda query — comparte
 * el resultado del fetch del layout.
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const storeData = await getStorefrontData(slug);
  if (!storeData) notFound();
  return <>{children}</>;
}
