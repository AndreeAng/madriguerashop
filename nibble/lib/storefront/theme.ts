const DEFAULT_ACTION = "#db7706"; // --color-amber-500
const SCHEMA_DEFAULT_PRIMARY = "#3b82f6"; // sin elegir: `Store.primaryColor` @default
const DARK_INK = "#100c08"; // --color-bark-900
const LIGHT_INK = "#ffffff";

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Color de acción de una tienda y la tinta legible encima. El comercio elige
 * cualquier hex, así que la tinta se calcula en vez de asumir blanco.
 */
export function storeActionColors(primaryColor: string): {
  action: string;
  onAction: string;
} {
  const hex = primaryColor.toLowerCase();
  const action =
    /^#[0-9a-f]{6}$/.test(hex) && hex !== SCHEMA_DEFAULT_PRIMARY
      ? hex
      : DEFAULT_ACTION;
  const lum = relativeLuminance(action);
  const onAction =
    contrast(lum, relativeLuminance(DARK_INK)) >=
    contrast(lum, relativeLuminance(LIGHT_INK))
      ? DARK_INK
      : LIGHT_INK;
  return { action, onAction };
}
