/**
 * Genera el ID de ancla DOM de una categoría a partir de su nombre.
 *
 * Se usa para:
 *  - El `id="cat-<anchor>"` de cada `<section>` de categoría en el storefront.
 *  - El `href="#cat-<anchor>"` de links que apuntan a una categoría
 *    (chips del menú + targets del LinkTargetPicker para banners/popups).
 *
 * Normaliza acentos y espacios para que "Café" y "Cafe" colisionen en
 * el mismo anchor — el owner no debería tener que pensar en eso al
 * elegir nombre de categoría.
 *
 * NO uso `Category.slug` de DB porque la sección del storefront se
 * agrupa por NOMBRE (StorefrontMenu indexa por nombre, no por slug),
 * y queremos un solo identificador que los dos lados generen igual.
 */
export function categoryAnchorId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}
