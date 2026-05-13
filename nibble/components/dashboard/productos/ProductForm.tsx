"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@prisma/client";
import { upsertProductAction } from "@/server/actions/products";
import type { ActionState } from "@/server/actions/store-settings";
import { slugify } from "@/lib/validation/slug";
import {
  StatusBadge,
  TextArea,
  ToggleField,
} from "@/components/dashboard/settings/SectionShell";
import { ProductImagesField } from "./ProductImagesField";
import { ProductVariantsField } from "./ProductVariantsField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

type SerializableProduct = Pick<
  Product,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "shortDescription"
  | "sku"
  | "manageStock"
  | "stock"
  | "lowStockAlert"
  | "isActive"
  | "isFeatured"
  | "isNew"
  | "isBestSeller"
  | "customLabel"
  | "categoryId"
  | "hasSchedule"
  | "availableFrom"
  | "availableTo"
  | "availableDays"
  | "isBookable"
  | "bookingDurationMin"
  | "bookingBufferMin"
> & {
  basePrice: string;
  comparePrice: string | null;
  images: { url: string; alt: string | null }[];
  variants: {
    id: string;
    name: string;
    sku: string | null;
    price: string | null;
    manageStock: boolean;
    stock: number;
  }[];
};

export function ProductForm({
  product,
  categories,
}: {
  product?: SerializableProduct | null;
  categories: Pick<Category, "id" | "name">[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(upsertProductAction, initial);
  const fe = state.fieldErrors ?? {};

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const [basePrice, setBasePrice] = useState(product?.basePrice ?? "");
  const [imagesUploading, setImagesUploading] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  // Guard contra doble navegación: solo redirigimos una vez por sesión del form.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (state.ok && !redirectedRef.current) {
      redirectedRef.current = true;
      router.push("/dashboard/productos");
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={action} noValidate className="space-y-6">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      {/* ============== Básico ============== */}
      <Section title="Información básica">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field
            label="Nombre"
            required
            error={fe.name}
            input={
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wings Clásicos BBQ"
                maxLength={120}
                aria-invalid={Boolean(fe.name)}
                className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            }
          />

          <Field
            label="SKU (opcional)"
            error={fe.sku}
            input={
              <input
                name="sku"
                defaultValue={product?.sku ?? ""}
                maxLength={40}
                placeholder="WGS-BBQ-12"
                className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            }
          />
        </div>

        <Field
          label="Slug"
          hint={`URL: tutienda/p/${effectiveSlug || "wings-clasicos"}`}
          error={fe.slug}
          input={
            <input
              name="slug"
              type="text"
              autoComplete="off"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              aria-invalid={Boolean(fe.slug)}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
          }
        />

        <TextArea
          name="shortDescription"
          label="Descripción corta"
          defaultValue={product?.shortDescription}
          placeholder="Para mostrar en cards y previews."
          rows={2}
          maxLength={160}
          error={fe.shortDescription}
        />

        <TextArea
          name="description"
          label="Descripción completa"
          defaultValue={product?.description}
          placeholder="12 alitas marinadas 24h, glaseadas con nuestra salsa BBQ ahumada."
          rows={5}
          maxLength={2000}
          error={fe.description}
        />

        <Field
          label="Categoría"
          error={fe.categoryId}
          input={
            <select
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            >
              <option value="">— Sin categoría —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          }
        />
      </Section>

      {/* ============== Precio + stock ============== */}
      <Section title="Precio y stock">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Precio (Bs)"
            required
            error={fe.basePrice}
            input={
              <input
                name="basePrice"
                inputMode="decimal"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="55.00"
                aria-invalid={Boolean(fe.basePrice)}
                className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            }
          />
          <Field
            label="Precio sin descuento (opcional)"
            hint="Se muestra tachado al lado del precio. Útil para promos."
            error={fe.comparePrice}
            input={
              <input
                name="comparePrice"
                inputMode="decimal"
                defaultValue={product?.comparePrice ?? ""}
                placeholder="65.00"
                className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            }
          />
        </div>

        <ToggleField
          name="manageStock"
          label="Llevar inventario"
          description="Si lo prendes, no se podrá vender más allá del stock disponible."
          defaultChecked={product?.manageStock ?? false}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Stock"
            error={fe.stock}
            input={
              <input
                name="stock"
                inputMode="numeric"
                defaultValue={product?.stock ?? 0}
                placeholder="0"
                className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            }
          />
          <Field
            label="Avisar cuando queden menos de"
            hint="Te avisamos en el dashboard. Dejá vacío para no recibir alerta."
            error={fe.lowStockAlert}
            input={
              <input
                name="lowStockAlert"
                inputMode="numeric"
                defaultValue={product?.lowStockAlert ?? ""}
                placeholder="5"
                className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            }
          />
        </div>
      </Section>

      {/* ============== Imágenes ============== */}
      <Section title="Imágenes">
        <ProductImagesField
          name="imagesJson"
          initial={(product?.images ?? []).map((i) => ({
            url: i.url,
            alt: i.alt ?? undefined,
          }))}
          onUploadingChange={setImagesUploading}
        />
        {fe.imagesJson && (
          <p role="alert" className="text-xs text-[color:var(--color-tomato-600)]">
            {fe.imagesJson}
          </p>
        )}
      </Section>

      {/* ============== Variantes ============== */}
      <Section title="Variantes">
        <ProductVariantsField
          name="variantsJson"
          basePrice={basePrice}
          initial={(product?.variants ?? []).map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku ?? undefined,
            price: v.price ? String(v.price) : "",
            manageStock: v.manageStock,
            stock: String(v.stock ?? 0),
          }))}
        />
        {fe.variantsJson && (
          <p role="alert" className="text-xs text-[color:var(--color-tomato-600)]">
            {fe.variantsJson}
          </p>
        )}
      </Section>

      {/* ============== Disponibilidad por horario ============== */}
      <Section title="Disponibilidad por horario">
        <ScheduleField
          hasSchedule={product?.hasSchedule ?? false}
          availableFrom={product?.availableFrom ?? null}
          availableTo={product?.availableTo ?? null}
          availableDays={product?.availableDays ?? []}
        />
      </Section>

      {/* ============== Reservas (servicios) ============== */}
      <Section title="Reservas">
        <BookableField
          isBookable={product?.isBookable ?? false}
          bookingDurationMin={product?.bookingDurationMin ?? 30}
          bookingBufferMin={product?.bookingBufferMin ?? 0}
        />
      </Section>

      {/* ============== Visibilidad y badges ============== */}
      <Section title="Visibilidad y destacados">
        <ToggleField
          name="isActive"
          label="Activo"
          description="Si se desactiva, no aparece en el storefront."
          defaultChecked={product?.isActive ?? true}
        />
        <ToggleField
          name="isFeatured"
          label="Destacado en home"
          description="Aparece arriba en 'Lo más pedido hoy'."
          defaultChecked={product?.isFeatured ?? false}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleField
            name="isNew"
            label="Mostrar como 'Nuevo'"
            defaultChecked={product?.isNew ?? false}
          />
          <ToggleField
            name="isBestSeller"
            label="Mostrar como 'Más vendido'"
            defaultChecked={product?.isBestSeller ?? false}
          />
        </div>
        <Field
          label="Etiqueta personalizada (opcional)"
          hint="Reemplaza 'Nuevo'/'Más vendido' con tu propio texto. Ej. 'Solo hoy', 'Recomendado'."
          error={fe.customLabel}
          input={
            <input
              name="customLabel"
              defaultValue={product?.customLabel ?? ""}
              maxLength={40}
              placeholder="Solo hoy"
              className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
          }
        />
      </Section>

      <StatusBadge ok={state.ok} error={state.error} />

      <div className="sticky bottom-4 flex items-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-3 shadow-soft">
        <SubmitButton
          disabled={imagesUploading}
          pendingLabel={imagesUploading ? "Subiendo imágenes…" : "Guardando…"}
        >
          {product?.id ? "Guardar cambios" : "Crear producto"}
        </SubmitButton>
        <button
          type="button"
          onClick={() => router.push("/dashboard/productos")}
          className="rounded-xl border border-[color:var(--line)] px-4 py-2.5 text-sm hover:bg-[color:var(--bg)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6">
      <h2 className="font-display text-lg">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  input,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}
        {required && <span className="ml-1 text-[color:var(--color-tomato-600)]">*</span>}
      </span>
      {input}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

const DAY_LABELS = [
  { idx: 0, short: "Dom" },
  { idx: 1, short: "Lun" },
  { idx: 2, short: "Mar" },
  { idx: 3, short: "Mié" },
  { idx: 4, short: "Jue" },
  { idx: 5, short: "Vie" },
  { idx: 6, short: "Sáb" },
];

/**
 * Toggle "Es un servicio reservable" + parámetros de duración y buffer.
 * Cuando está activo, el storefront muestra calendario de slots en lugar
 * del botón "Agregar al carrito". El stock/manageStock no aplica para
 * bookables — el control de capacidad lo hace el calendario.
 */
function BookableField({
  isBookable: initialBookable,
  bookingDurationMin,
  bookingBufferMin,
}: {
  isBookable: boolean;
  bookingDurationMin: number;
  bookingBufferMin: number;
}) {
  const [enabled, setEnabled] = useState(initialBookable);

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4 transition hover:bg-[color:var(--card)]">
        <input
          name="isBookable"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 rounded border-[color:var(--line-strong)] accent-[color:var(--color-amber-500)]"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium">
            Es un servicio reservable
          </span>
          <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
            Cortes, manicures, masajes… El cliente elige día y hora en
            lugar de comprar. Las reservas aparecen en{" "}
            <strong>Dashboard → Reservas</strong>.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="grid gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-[color:var(--muted)]">
              Duración del servicio (minutos)
            </span>
            <input
              name="bookingDurationMin"
              type="number"
              min={15}
              max={480}
              step={15}
              defaultValue={bookingDurationMin}
              className="mt-1.5 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">
              Cuánto te lleva atender uno. Típico: 30–60 min.
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[color:var(--muted)]">
              Buffer entre reservas (minutos)
            </span>
            <input
              name="bookingBufferMin"
              type="number"
              min={0}
              max={120}
              step={5}
              defaultValue={bookingBufferMin}
              className="mt-1.5 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted)]">
              Tiempo libre entre reservas (limpieza, descanso). Default 0.
            </p>
          </label>
        </div>
      )}
    </div>
  );
}

function ScheduleField({
  hasSchedule: initialHas,
  availableFrom,
  availableTo,
  availableDays,
}: {
  hasSchedule: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  availableDays: number[];
}) {
  const [enabled, setEnabled] = useState(initialHas);
  const [days, setDays] = useState<number[]>(availableDays);

  function toggleDay(idx: number) {
    setDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort(),
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4 transition hover:bg-[color:var(--card)]">
        <input
          name="hasSchedule"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 rounded border-[color:var(--line-strong)] accent-[color:var(--color-amber-500)]"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium">
            Sólo disponible en horarios específicos
          </span>
          <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
            Útil para combos del almuerzo, especiales del fin de semana, etc. Si
            está apagado, el producto se vende durante todo el horario de la tienda.
          </span>
        </span>
      </label>

      {enabled && <input type="hidden" name="availableDays" value={days.join(",")} />}

      {enabled && (
        <div className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[color:var(--muted)]">
                Disponible desde
              </span>
              <input
                name="availableFrom"
                type="time"
                defaultValue={availableFrom ?? "11:00"}
                className="mt-1.5 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[color:var(--muted)]">
                Disponible hasta
              </span>
              <input
                name="availableTo"
                type="time"
                defaultValue={availableTo ?? "15:00"}
                className="mt-1.5 w-full rounded-lg border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-medium text-[color:var(--muted)]">
              Días de la semana
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAY_LABELS.map((d) => {
                const isOn = days.includes(d.idx);
                return (
                  <button
                    key={d.idx}
                    type="button"
                    onClick={() => toggleDay(d.idx)}
                    className={`inline-flex size-10 items-center justify-center rounded-full border text-xs font-medium transition ${
                      isOn
                        ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
                        : "border-[color:var(--line-strong)] bg-[color:var(--card)] text-[color:var(--muted)] hover:border-[color:var(--color-bark-300)]"
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
            {days.length === 0 && (
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Sin días seleccionados se interpreta como todos los días.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
