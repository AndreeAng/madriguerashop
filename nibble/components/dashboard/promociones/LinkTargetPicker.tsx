"use client";

import { useMemo, useState } from "react";
import { categoryAnchorId } from "@/lib/storefront/category-anchor";

/**
 * Selector de destino para banners/popups. En vez de pedirle al owner
 * que escriba URLs a mano (que se pueden tipear mal: "/cataegoría/wings"
 * → 404), le damos un dropdown con los destinos REALES de su tienda:
 *
 *   - Sin enlace
 *   - Una categoría específica (anchor en el menú)
 *   - Un producto específico (PDP)
 *   - WhatsApp del local
 *   - URL personalizada (escape hatch para externos: Instagram, formulario, etc.)
 *
 * El componente resuelve la URL final y la expone vía `<input type="hidden"
 * name={name}>` para que el form parent la mande al server sin cambios.
 *
 * UX en 2 pasos: primero el TIPO (select de modos), después aparece el
 * select específico (categoría/producto) o el input (custom). Mantiene
 * el dropdown principal corto incluso con catálogos de 50+ productos.
 */

type LinkMode = "none" | "category" | "product" | "whatsapp" | "custom";

type Category = { name: string };
type Product = { slug: string; name: string };

export function LinkTargetPicker({
  name,
  label,
  defaultValue,
  storeSlug,
  storeWhatsappPhone,
  categories,
  products,
  error,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string;
  storeSlug: string;
  storeWhatsappPhone: string;
  categories: Category[];
  products: Product[];
  error?: string;
  hint?: string;
}) {
  // Determina el modo inicial a partir del `defaultValue`. Si el valor
  // matchea alguno de los destinos conocidos, seleccionamos ese modo;
  // sino caemos a "personalizada" para que el owner vea su URL anterior.
  const { initialMode, initialPayload } = useMemo<{
    initialMode: LinkMode;
    initialPayload: string;
  }>(() => {
    if (!defaultValue) return { initialMode: "none", initialPayload: "" };

    const waPhone = storeWhatsappPhone.replace(/\D/g, "");
    if (waPhone && defaultValue.includes(`wa.me/${waPhone}`)) {
      return { initialMode: "whatsapp", initialPayload: "" };
    }

    const pdpMatch = defaultValue.match(
      new RegExp(`^/${storeSlug}/p/([^/?#]+)`),
    );
    if (pdpMatch) {
      const slug = pdpMatch[1]!;
      if (products.some((p) => p.slug === slug)) {
        return { initialMode: "product", initialPayload: slug };
      }
    }

    const catMatch = defaultValue.match(/#cat-(.+)$/);
    if (catMatch) {
      const anchor = catMatch[1]!;
      const cat = categories.find((c) => categoryAnchorId(c.name) === anchor);
      if (cat) {
        return { initialMode: "category", initialPayload: cat.name };
      }
    }

    return { initialMode: "custom", initialPayload: defaultValue };
  }, [defaultValue, storeSlug, storeWhatsappPhone, categories, products]);

  const [mode, setMode] = useState<LinkMode>(initialMode);
  const [payload, setPayload] = useState(initialPayload);

  const resolvedUrl = useMemo(() => {
    switch (mode) {
      case "none":
        return "";
      case "category":
        return payload ? `/${storeSlug}#cat-${categoryAnchorId(payload)}` : "";
      case "product":
        return payload ? `/${storeSlug}/p/${payload}` : "";
      case "whatsapp": {
        const phone = storeWhatsappPhone.replace(/\D/g, "");
        return phone ? `https://wa.me/${phone}` : "";
      }
      case "custom":
        return payload;
    }
  }, [mode, payload, storeSlug, storeWhatsappPhone]);

  return (
    <div>
      <label className="block">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          {label}
        </span>
        <select
          value={mode}
          onChange={(e) => {
            const next = e.target.value as LinkMode;
            setMode(next);
            // Al cambiar de modo limpiamos el payload — un slug de producto
            // no aplica si pasamos a categoría, y viceversa.
            if (next !== mode) setPayload("");
          }}
          className={`mt-1 w-full rounded-xl border ${
            error
              ? "border-[color:var(--color-tomato-500)]"
              : "border-[color:var(--line-strong)]"
          } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
        >
          <option value="none">Sin enlace</option>
          <option value="category" disabled={categories.length === 0}>
            Una categoría de tu menú{categories.length === 0 ? " (sin categorías aún)" : ""}
          </option>
          <option value="product" disabled={products.length === 0}>
            Un producto específico{products.length === 0 ? " (sin productos aún)" : ""}
          </option>
          <option value="whatsapp">Abrir WhatsApp del local</option>
          <option value="custom">URL personalizada (externa)</option>
        </select>
      </label>

      {mode === "category" && (
        <select
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
        >
          <option value="">— Elegí la categoría —</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {mode === "product" && (
        <select
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
        >
          <option value="">— Elegí el producto —</option>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {mode === "custom" && (
        <input
          type="text"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="https://instagram.com/tu-tienda"
          className="mt-2 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
        />
      )}

      {mode === "whatsapp" && (
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Abre el chat de WhatsApp del local en el celular del cliente.
        </p>
      )}

      {/* Input hidden con la URL resuelta — esto es lo que ve el server. */}
      <input type="hidden" name={name} value={resolvedUrl} />

      {error ? (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      ) : resolvedUrl ? (
        <p className="mt-1 truncate text-[11px] text-[color:var(--muted)]">
          Destino: <span className="font-mono">{resolvedUrl}</span>
        </p>
      ) : null}
    </div>
  );
}
