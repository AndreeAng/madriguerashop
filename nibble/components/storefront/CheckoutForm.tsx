"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Bike,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  QrCode,
  Store as StoreIcon,
  Upload,
  X,
} from "lucide-react";
import type { StoreVertical } from "@prisma/client";
import {
  createOrderAction,
  type CreateOrderState,
} from "@/server/actions/orders";
import { formatBob } from "@/lib/utils";
import { storefrontCopy } from "@/lib/storefront/copy";
import { MapPicker } from "@/components/shared/MapsClient";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PhoneInputBO } from "@/components/shared/PhoneInputBO";
import { findMatchingZone } from "@/lib/delivery/geometry";
import type { CartSnapshot } from "@/server/actions/cart";

const initial: CreateOrderState = {};

type StoreInfo = {
  name: string;
  city: string;
  vertical: StoreVertical;
  acceptsQR: boolean;
  acceptsCashOnDelivery: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  defaultDeliveryFee: number | null;
  freeDeliveryAbove: number | null;
  deliveryNote: string | null;
  qrImageUrl: string | null;
  qrInstructions: string | null;
  isOpenNow: boolean;
  nextOpeningLabel: string | null;
};

type HoursDay = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type Zone = {
  id: string;
  name: string;
  fee: number;
  estimatedTime: string | null;
  /** Si la zona tiene círculo dibujado, podemos auto-detectarla desde
   *  el pin del cliente. Null = zona "legacy" sin mapa (sólo elegible
   *  manualmente). */
  shape: { lat: number; lng: number; radiusMeters: number } | null;
};

export function CheckoutForm({
  slug,
  store,
  cart,
  deliveryZones,
  hoursByDay,
}: {
  slug: string;
  store: StoreInfo;
  cart: CartSnapshot;
  deliveryZones: Zone[];
  hoursByDay: HoursDay[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(createOrderAction, initial);
  const fe = state.fieldErrors ?? {};
  const copy = storefrontCopy(store.vertical);

  // Defaults razonables: si una sola opción está habilitada, fijala.
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">(
    store.deliveryEnabled ? "delivery" : "pickup",
  );
  const [paymentMethod, setPaymentMethod] = useState<"QR_STATIC" | "CASH_ON_DELIVERY">(
    store.acceptsQR ? "QR_STATIC" : "CASH_ON_DELIVERY",
  );
  const [zoneId, setZoneId] = useState<string>("");
  const [pickedLatLng, setPickedLatLng] = useState<[number, number] | null>(null);
  const [proofUrl, setProofUrl] = useState<string>("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Detección automática de zona desde el pin. Si TODAS las zonas tienen
  // shape, asumimos modo "mapa-first" y ocultamos el select. Si hay
  // alguna sin shape (legacy), mostramos el select además del mapa para
  // que el cliente pueda elegirla a mano.
  const zonesWithShape = useMemo(
    () => deliveryZones.filter((z) => z.shape !== null),
    [deliveryZones],
  );
  const allZonesHaveShape =
    deliveryZones.length > 0 && zonesWithShape.length === deliveryZones.length;

  const autoDetectedZone = useMemo(() => {
    if (!pickedLatLng || zonesWithShape.length === 0) return null;
    // findMatchingZone necesita el polygon raw; lo armamos a partir del
    // shape ya parseado. Compatible con el helper que vive en server.
    const zonesForMatch = zonesWithShape.map((z) => ({
      id: z.id,
      polygon: { type: "circle" as const, ...z.shape! },
    }));
    const m = findMatchingZone(zonesForMatch, pickedLatLng[0], pickedLatLng[1]);
    return m ? deliveryZones.find((z) => z.id === m.id) ?? null : null;
  }, [pickedLatLng, zonesWithShape, deliveryZones]);

  // Cálculos de preview (mostrar al cliente — el servidor recalcula igual).
  // Prioridad de zona: auto-detectada por mapa > seleccionada en select > default.
  const effectiveZone =
    autoDetectedZone ?? deliveryZones.find((z) => z.id === zoneId) ?? null;
  const subtotal = cart.subtotal;
  const previewDeliveryFee = useMemo(() => {
    if (deliveryMethod !== "delivery") return null;
    let fee = effectiveZone ? effectiveZone.fee : (store.defaultDeliveryFee ?? 0);
    if (store.freeDeliveryAbove && subtotal >= store.freeDeliveryAbove) fee = 0;
    return fee;
  }, [deliveryMethod, effectiveZone, store, subtotal]);
  const previewTotal = subtotal + (previewDeliveryFee ?? 0);

  useEffect(() => {
    if (state.ok) {
      // Abrimos WhatsApp en una pestaña nueva y navegamos al tracking
      try {
        window.open(state.ok.whatsappUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
      router.push(`/${slug}/orden/${state.ok.trackingToken}`);
    }
  }, [state.ok, router, slug]);

  async function handleProofUpload(file: File) {
    setProofError(null);
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      // Reusamos el route handler de uploads — sin embargo requiere auth de owner.
      // Como el cliente final no tiene sesión, necesitamos una ruta pública.
      // Ver app/api/upload/proof/route.ts (creada para esto).
      const res = await fetch(`/api/upload/proof?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setProofError(data.error ?? "No pudimos subir el comprobante");
        return;
      }
      setProofUrl(data.url);
    } catch {
      setProofError("Error de red. Prueba de nuevo.");
    } finally {
      setUploadingProof(false);
    }
  }

  return (
    <form action={action} noValidate>
      <input type="hidden" name="storeSlug" value={slug} />
      <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="paymentProofUrl" value={proofUrl} />
      {/* deliveryZoneId mandado al server: auto-detectado si el cliente marcó
          el mapa y cayó en una zona; sino el select manual (legacy). El server
          de todos modos prioriza lat/lng sobre zoneId, este es respaldo. */}
      <input
        type="hidden"
        name="deliveryZoneId"
        value={autoDetectedZone?.id ?? zoneId}
      />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <h1 className="font-display text-3xl">Finalizar {copy.orderSingular}</h1>

          {state.error && (
            <p
              role="alert"
              className="rounded-xl border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-4 py-3 text-sm text-[color:var(--color-tomato-700)]"
            >
              {state.error}
            </p>
          )}

          {/* ============== 1. Datos ============== */}
          <Section step="1" title="Tus datos">
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Nombre completo"
                name="customerName"
                placeholder="Carla Mendoza"
                error={fe.customerName}
              />
              <PhoneInputBO
                label="Teléfono"
                name="customerPhone"
                error={fe.customerPhone}
                required
              />
            </div>
            <Field
              label="Email (opcional)"
              name="customerEmail"
              type="email"
              placeholder="carla@email.com"
              error={fe.customerEmail}
            />
          </Section>

          {/* ============== 2. Entrega ============== */}
          <Section step="2" title="Entrega">
            <div className="mb-3 flex flex-wrap gap-2">
              {store.deliveryEnabled && (
                <MethodToggle
                  active={deliveryMethod === "delivery"}
                  onClick={() => setDeliveryMethod("delivery")}
                  icon={<Bike className="size-4" />}
                  label="Delivery"
                />
              )}
              {store.pickupEnabled && (
                <MethodToggle
                  active={deliveryMethod === "pickup"}
                  onClick={() => setDeliveryMethod("pickup")}
                  icon={<StoreIcon className="size-4" />}
                  label="Recoger en local"
                />
              )}
            </div>

            {deliveryMethod === "delivery" ? (
              <div className="space-y-3">
                {/* Modo mapa-first: si todas las zonas tienen círculo
                    definido, NO mostramos select. El cliente marca su pin
                    y la zona se detecta sola. Si alguna zona es legacy
                    (sin shape) caemos al select para no romperla. */}
                {!allZonesHaveShape && deliveryZones.length > 0 && (
                  <label className="block">
                    <span className="text-xs font-medium text-[color:var(--muted)]">
                      Zona de delivery
                    </span>
                    <select
                      value={zoneId}
                      onChange={(e) => setZoneId(e.target.value)}
                      disabled={!!autoDetectedZone}
                      className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)] disabled:opacity-60"
                    >
                      <option value="">— Elige tu zona —</option>
                      {deliveryZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} — {formatBob(z.fee)}
                          {z.estimatedTime ? ` · ${z.estimatedTime}` : ""}
                        </option>
                      ))}
                    </select>
                    {autoDetectedZone && (
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        Detectamos tu zona desde el mapa. Si quieres cambiarla
                        manualmente, quitá el pin.
                      </p>
                    )}
                  </label>
                )}

                <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                  <Field
                    label="Dirección"
                    name="deliveryAddress"
                    placeholder="Av. América Este 1234"
                    error={fe.deliveryAddress}
                  />
                  <Field
                    label="Referencia (opcional)"
                    name="deliveryNote"
                    placeholder="Frente al kiosco azul, 2do piso"
                  />
                </div>

                {/* Mapa para marcar la ubicación exacta. Si la tienda tiene
                    zonas con shape, marcar el punto detecta la zona
                    automáticamente y muestra el fee al toque. */}
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)] p-4">
                  <p className="mb-3 text-xs font-medium text-[color:var(--fg)]">
                    {allZonesHaveShape ? "Tu ubicación" : "Ubicación exacta (opcional)"}
                  </p>
                  <MapPicker
                    onChange={(lat, lng) => setPickedLatLng([lat, lng])}
                  />
                  {pickedLatLng && (
                    <div className="mt-3">
                      {autoDetectedZone ? (
                        <p className="rounded-lg bg-[color:var(--color-leaf-50)] px-3 py-2 text-xs text-[color:var(--color-leaf-700)]">
                          ✓ Estás dentro de <strong>{autoDetectedZone.name}</strong> ·{" "}
                          {formatBob(autoDetectedZone.fee)}
                          {autoDetectedZone.estimatedTime
                            ? ` · ${autoDetectedZone.estimatedTime}`
                            : ""}
                        </p>
                      ) : zonesWithShape.length > 0 ? (
                        <p className="rounded-lg bg-[color:var(--color-amber-50)] px-3 py-2 text-xs text-[color:var(--color-amber-700)]">
                          Tu punto cae fuera de nuestras zonas de cobertura.
                          {store.defaultDeliveryFee != null
                            ? ` Si confirmamos el pedido, cobramos la tarifa por defecto (${formatBob(store.defaultDeliveryFee)}).`
                            : " Te contactamos por WhatsApp para coordinar."}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                {previewDeliveryFee !== null && (
                  <div className="flex items-center justify-between rounded-xl bg-[color:var(--bg)] px-4 py-3 text-sm">
                    <span className="text-[color:var(--muted)] inline-flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {previewDeliveryFee === 0
                        ? "Delivery gratis 🎉"
                        : "Costo de envío estimado"}
                    </span>
                    <span className="font-semibold">{formatBob(previewDeliveryFee)}</span>
                  </div>
                )}

                {store.deliveryNote && (
                  <p className="text-xs text-[color:var(--muted)]">
                    {store.deliveryNote}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-[color:var(--bg)] p-4 text-sm text-[color:var(--muted)]">
                {copy.cartLabel} va a estar listo para recoger en el local.
              </p>
            )}
          </Section>

          {/* ============== 3. Programación (cuándo) ============== */}
          <Section
            step="3"
            title={
              store.isOpenNow
                ? "¿Cuándo lo quieres?"
                : "Programar para más tarde"
            }
          >
            <SchedulePicker
              isOpenNow={store.isOpenNow}
              nextOpeningLabel={store.nextOpeningLabel}
              hoursByDay={hoursByDay}
              deliveryMethod={deliveryMethod}
              error={fe.scheduledFor}
              cartLabel={copy.cartLabel}
            />
          </Section>

          {/* ============== 4. Pago ============== */}
          <Section step="4" title="Método de pago">
            <div className="grid gap-3 md:grid-cols-2">
              {store.acceptsQR && (
                <PayCard
                  active={paymentMethod === "QR_STATIC"}
                  onClick={() => setPaymentMethod("QR_STATIC")}
                  icon={<QrCode className="size-5" />}
                  title="QR del banco"
                  desc="Pagas con tu app del banco. Subes el comprobante."
                />
              )}
              {store.acceptsCashOnDelivery && (
                <PayCard
                  active={paymentMethod === "CASH_ON_DELIVERY"}
                  onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                  icon={<Banknote className="size-5" />}
                  title="Contra entrega"
                  desc="Pagas en efectivo cuando recibes el pedido."
                />
              )}
            </div>

            {fe.paymentMethod && (
              <p role="alert" className="mt-2 text-xs text-[color:var(--color-tomato-600)]">
                {fe.paymentMethod}
              </p>
            )}

            {paymentMethod === "QR_STATIC" && (
              <div className="mt-4 grid gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--card)] p-4 md:grid-cols-[180px_1fr]">
                {store.qrImageUrl ? (
                  <div className="aspect-square overflow-hidden rounded-xl bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={store.qrImageUrl}
                      alt="QR de pago"
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="grid aspect-square place-items-center rounded-xl bg-[color:var(--bg)] text-[color:var(--muted)]">
                    <QrCode className="size-12" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">
                    Escanea el QR para pagar {formatBob(previewTotal)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {store.qrInstructions ??
                      "Una vez pagado, sube el comprobante. La tienda lo verifica antes de confirmar."}
                  </p>
                  <ProofUploader
                    proofUrl={proofUrl}
                    uploading={uploadingProof}
                    onUpload={handleProofUpload}
                    onClear={() => setProofUrl("")}
                  />
                  {(fe.paymentProofUrl || proofError) && (
                    <p
                      role="alert"
                      className="mt-2 text-xs text-[color:var(--color-tomato-600)]"
                    >
                      {fe.paymentProofUrl ?? proofError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* ============== 4. Cupón / notas ============== */}
          <Section step="5" title="Cupón y notas (opcional)">
            <div className="grid gap-3">
              <Field
                label="Código de cupón"
                name="couponCode"
                placeholder="BIENVENIDO10"
                error={fe.couponCode}
              />
              <label className="block">
                <span className="text-xs font-medium text-[color:var(--muted)]">
                  Notas para la tienda
                </span>
                <textarea
                  name="customerNotes"
                  rows={2}
                  placeholder={`Ej. Tocar el timbre dos veces. ${copy.checkoutNotesPlaceholder}`}
                  className="mt-1.5 w-full resize-y rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
                  maxLength={500}
                />
              </label>
            </div>
          </Section>
        </div>

        {/* ============== Resumen ============== */}
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {/* Aviso de cart purgado: aparece cuando un producto/variante del
              carrito fue eliminado o desactivado entre visitas. Se purga
              automáticamente con la próxima recarga (server limpia los IDs
              huérfanos en buildSnapshot). */}
          {cart.notice === "items_removed" && (
            <div
              role="status"
              className="rounded-2xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-4 text-sm text-[color:var(--color-amber-900)]"
            >
              <p className="font-medium">El producto cambió, revisa tu carrito.</p>
              <p className="mt-1 text-xs">
                Quitamos algún artículo porque ya no está disponible o el
                vendedor lo modificó.
              </p>
            </div>
          )}
          <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
            <h3 className="font-semibold">{copy.cartLabel}</h3>
            <ul className="mt-4 divide-y divide-[color:var(--line)]">
              {cart.items.map((line) => (
                <li key={line.id} className="flex gap-3 py-3">
                  <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[color:var(--bg)]">
                    {/* La cart snapshot no tiene image; placeholder */}
                    <span className="text-[10px] uppercase text-[color:var(--muted)]">
                      ×{line.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{line.product.name}</p>
                    {line.variant && (
                      <p className="text-xs text-[color:var(--muted)]">
                        {line.variant.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[color:var(--muted)]">
                      {line.quantity} × {formatBob(Number(line.unitPrice))}
                    </p>
                  </div>
                  <span className="text-sm font-medium num-tabular">
                    {formatBob(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-[color:var(--line)] pt-4 text-sm">
              <Row label="Subtotal" value={formatBob(subtotal)} />
              {previewDeliveryFee !== null && (
                <Row
                  label={previewDeliveryFee === 0 ? "Envío (gratis)" : "Envío"}
                  value={formatBob(previewDeliveryFee)}
                />
              )}
              <p className="text-[10px] text-[color:var(--muted)]">
                Si usas cupón, se aplica al confirmar el pedido.
              </p>
              <div className="flex justify-between border-t border-[color:var(--line)] pt-3 text-base font-semibold">
                <span>Total estimado</span>
                <span className="font-display text-2xl num-tabular">
                  {formatBob(previewTotal)}
                </span>
              </div>
            </div>

            <CheckoutSubmit paymentMethod={paymentMethod} proofUrl={proofUrl} />

            <p className="mt-3 text-center text-xs text-[color:var(--muted)]">
              Al confirmar abres WhatsApp con el resumen del pedido para {store.name}.
            </p>
          </div>
        </aside>
      </main>
    </form>
  );
}

function CheckoutSubmit({
  paymentMethod,
  proofUrl,
}: {
  paymentMethod: string;
  proofUrl: string;
}) {
  const blocked = paymentMethod === "QR_STATIC" && !proofUrl;
  return (
    <SubmitButton
      shape="pill"
      width="full"
      className="mt-5 py-3.5"
      disabled={blocked}
      pendingLabel="Creando pedido…"
    >
      <MessageCircle className="size-4" />
      Confirmar y avisar por WhatsApp
    </SubmitButton>
  );
}

function ProofUploader({
  proofUrl,
  uploading,
  onUpload,
  onClear,
}: {
  proofUrl: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const id = useId();

  if (proofUrl) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[color:var(--color-leaf-500)]/40 bg-[color:var(--color-leaf-500)]/5 p-3 text-sm">
        <CheckCircle2 className="size-5 text-[color:var(--color-leaf-600)]" />
        <span className="flex-1 text-[color:var(--color-leaf-600)]">
          Comprobante listo
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Quitar comprobante"
          className="grid size-7 place-items-center rounded-full text-[color:var(--muted)] hover:bg-[color:var(--bg)]"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <label
        htmlFor={id}
        className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-[color:var(--color-bark-300)] bg-[color:var(--bg)] px-4 py-3 text-sm font-medium hover:border-[color:var(--color-bark-900)]"
      >
        {uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Subiendo…
          </>
        ) : (
          <>
            <Upload className="size-4" /> Subir comprobante (JPG / PNG · máx 5 MB)
          </>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
        className="sr-only"
      />
    </>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-7 place-items-center rounded-full bg-[color:var(--color-bark-900)] text-xs font-semibold text-white">
          {step}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  inputMode,
  error,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
      />
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

function MethodToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-[color:var(--color-bark-900)] bg-[color:var(--color-bark-900)] text-white"
          : "border-[color:var(--line)] bg-[color:var(--card)] hover:border-[color:var(--color-bark-300)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PayCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-[color:var(--color-amber-500)] bg-[color:var(--color-amber-50)]"
          : "border-[color:var(--line)] bg-[color:var(--bg)] hover:border-[color:var(--color-bark-300)]"
      }`}
    >
      <div className="grid size-9 place-items-center rounded-lg bg-[color:var(--color-bark-900)] text-white">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-[color:var(--muted)]">{desc}</p>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className="num-tabular">{value}</span>
    </div>
  );
}

// ============== Schedule picker ==============
//
// Si la tienda está cerrada AHORA, el picker se muestra abierto y exige
// elegir un horario futuro dentro del rango abierto. Si está abierta, se
// puede dejar vacío (entrega ASAP) o programar para más tarde como opción.
//
// El input es `datetime-local` (nativo del browser): UX simple, sin
// dependencias de date pickers. El server valida que caiga en horario.
const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function SchedulePicker({
  isOpenNow,
  nextOpeningLabel,
  hoursByDay,
  deliveryMethod,
  error,
  cartLabel,
}: {
  isOpenNow: boolean;
  nextOpeningLabel: string | null;
  hoursByDay: HoursDay[];
  deliveryMethod: "delivery" | "pickup";
  error?: string;
  /** "Tu pedido"/"Tu solicitud" según vertical — para la frase
   * "{cartLabel} queda agendado para…". */
  cartLabel: string;
}) {
  const [mode, setMode] = useState<"asap" | "scheduled">(
    isOpenNow ? "asap" : "scheduled",
  );

  // Default datetime: si está cerrado, sugerimos la próxima apertura
  // (parsing del nextOpeningLabel sería frágil — lo calculamos local).
  // Si está abierto, sugerimos 30 minutos en el futuro como punto de
  // partida razonable.
  const defaultDateTime = useMemo(() => {
    if (isOpenNow) {
      const d = new Date(Date.now() + 30 * 60 * 1000);
      return toLocalInputValue(d);
    }
    // Encontrar el próximo día abierto y poner la hora de apertura
    const now = new Date();
    const dow = now.getDay();
    const hhmm =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
    const today = hoursByDay.find((h) => h.dayOfWeek === dow);
    if (today && !today.isClosed && hhmm < today.openTime) {
      const d = new Date();
      const [hh, mm] = today.openTime.split(":").map(Number);
      d.setHours(hh ?? 10, mm ?? 0, 0, 0);
      return toLocalInputValue(d);
    }
    for (let i = 1; i <= 7; i++) {
      const targetDow = (dow + i) % 7;
      const day = hoursByDay.find((h) => h.dayOfWeek === targetDow);
      if (day && !day.isClosed) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const [hh, mm] = day.openTime.split(":").map(Number);
        d.setHours(hh ?? 10, mm ?? 0, 0, 0);
        return toLocalInputValue(d);
      }
    }
    return "";
  }, [isOpenNow, hoursByDay]);

  const minDateTime = toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000));
  const maxDateTime = toLocalInputValue(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  );

  const [picked, setPicked] = useState(defaultDateTime);

  // El cliente envía `scheduledFor` como ISO si está en modo scheduled,
  // o vacío si es ASAP. El server interpreta el campo vacío como ASAP.
  const scheduledIso = useMemo(() => {
    if (mode !== "scheduled" || !picked) return "";
    const d = new Date(picked);
    return Number.isFinite(d.getTime()) ? d.toISOString() : "";
  }, [mode, picked]);

  // Hint humano: "Viernes 16/05 14:30" si tiene valor
  const pickedLabel = useMemo(() => {
    if (!picked) return null;
    const d = new Date(picked);
    if (!Number.isFinite(d.getTime())) return null;
    const day = DAY_NAMES_ES[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${dd}/${mm} a las ${hh}:${min}`;
  }, [picked]);

  const verb = deliveryMethod === "delivery" ? "te llegue" : "lo recogés";

  return (
    <div className="space-y-3">
      <input type="hidden" name="scheduledFor" value={scheduledIso} />

      {!isOpenNow && (
        <div className="rounded-xl border border-[color:var(--color-amber-300)] bg-[color:var(--color-amber-50)] p-3 text-xs text-[color:var(--color-amber-800)]">
          La tienda está cerrada ahora{nextOpeningLabel ? ` — ${nextOpeningLabel.toLowerCase()}` : ""}.
          Puedes pagar igual y elegir cuándo {verb}.
        </div>
      )}

      {isOpenNow && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] p-1.5">
          <ModeChip
            active={mode === "asap"}
            onClick={() => setMode("asap")}
            label="Lo antes posible"
          />
          <ModeChip
            active={mode === "scheduled"}
            onClick={() => setMode("scheduled")}
            label="Programar"
          />
        </div>
      )}

      {mode === "scheduled" && (
        <div>
          <label className="block text-xs font-medium text-[color:var(--muted)]">
            Día y hora ({deliveryMethod === "delivery" ? "entrega" : "recojo"})
          </label>
          <input
            type="datetime-local"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            min={minDateTime}
            max={maxDateTime}
            required
            className="mt-1.5 w-full rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-amber-400)]"
          />
          {pickedLabel && (
            <p className="mt-1.5 text-xs text-[color:var(--muted)]">
              {cartLabel} queda agendado para{" "}
              <strong className="text-[color:var(--fg)]">{pickedLabel}</strong>.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-[color:var(--color-bark-900)] text-white"
          : "text-[color:var(--fg-soft)] hover:bg-[color:var(--card)]"
      }`}
    >
      {label}
    </button>
  );
}

/** Convierte un `Date` a "YYYY-MM-DDTHH:mm" en hora LOCAL para el
 *  `<input type="datetime-local">`. Sin la conversión a local, el input
 *  pinta UTC y el cliente se confunde. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
