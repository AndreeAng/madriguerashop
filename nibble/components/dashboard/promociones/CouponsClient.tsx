"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Pencil,
  Plus,
  Tag,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { CouponType } from "@prisma/client";
import {
  deleteCouponAction,
  upsertCouponAction,
  type CouponFormState,
} from "@/server/actions/coupons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorAlert } from "@/components/ui/Alert";
import { formatBob } from "@/lib/utils";
import { inBolivia } from "@/lib/booking/timezone";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: string;
  minOrderAmount: string | null;
  maxDiscountAmount: string | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
};

const initial: CouponFormState = {};

const TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo (Bs)",
  FREE_SHIPPING: "Envío gratis",
};

export function CouponsClient({ coupons }: { coupons: Coupon[] }) {
  const [mode, setMode] = useState<
    { type: "list" } | { type: "new" } | { type: "edit"; coupon: Coupon }
  >({ type: "list" });
  const [pendingDelete, setPendingDelete] = useState<Coupon | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(c: Coupon) {
    setError(null);
    const fd = new FormData();
    fd.set("id", c.id);
    startTransition(async () => {
      const res = await deleteCouponAction(fd);
      if (res.error) setError(res.error);
    });
  }

  if (mode.type !== "list") {
    return (
      <CouponForm
        coupon={mode.type === "edit" ? mode.coupon : null}
        onDone={() => setMode({ type: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--muted)]">
          {coupons.length === 0
            ? "Sin cupones todavía."
            : `${coupons.length} ${coupons.length === 1 ? "cupón" : "cupones"}`}
        </p>
        <button
          type="button"
          onClick={() => setMode({ type: "new" })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-bark-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-bark-700)]"
        >
          <Plus className="size-4" />
          Nuevo cupón
        </button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-8" />}
          description={
            <>
              Sin cupones. Útiles para fidelizar clientes recurrentes
              (cupón &ldquo;VUELVE10&rdquo; con 10% para quien ya pidió) o para
              promos puntuales (BLACK20 con envío gratis fin de semana).
            </>
          }
        />
      ) : (
        <ul className="space-y-3">
          {coupons.map((c) => (
            <CouponRow
              key={c.id}
              coupon={c}
              onEdit={() => setMode({ type: "edit", coupon: c })}
              onDelete={() => setPendingDelete(c)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`¿Eliminar "${pendingDelete?.code}"?`}
        message={
          pendingDelete && pendingDelete.usedCount > 0
            ? `Este cupón ya se usó ${pendingDelete.usedCount} ${pendingDelete.usedCount === 1 ? "vez" : "veces"}. No se borra del historial — queda como inactivo.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel={
          pendingDelete && pendingDelete.usedCount > 0
            ? "Desactivar"
            : "Eliminar"
        }
        destructive
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function CouponRow({
  coupon,
  onEdit,
  onDelete,
}: {
  coupon: Coupon;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const live = isLiveNow(coupon);
  const usageText =
    coupon.usageLimit != null
      ? `${coupon.usedCount}/${coupon.usageLimit} usos`
      : `${coupon.usedCount} usos`;
  const valueText =
    coupon.type === "PERCENTAGE"
      ? `${Number(coupon.value)}%`
      : coupon.type === "FIXED_AMOUNT"
        ? formatBob(Number(coupon.value))
        : "Envío gratis";

  return (
    <li className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[color:var(--card-soft)] text-[color:var(--fg-soft)]">
          <Tag className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-bold tracking-wide">
              {coupon.code}
            </p>
            <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--fg-soft)]">
              {valueText}
            </span>
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                ACTIVO
              </span>
            ) : !coupon.isActive ? (
              <span className="rounded-full bg-[color:var(--bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                Inactivo
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Fuera de fecha
              </span>
            )}
          </div>
          {coupon.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-[color:var(--muted)]">
              {coupon.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--muted)]">
            <span>{TYPE_LABELS[coupon.type]}</span>
            <span>· {usageText}</span>
            {coupon.minOrderAmount && (
              <span>
                · mínimo {formatBob(Number(coupon.minOrderAmount))}
              </span>
            )}
            <span>
              · {formatDate(coupon.validFrom)} → {formatDate(coupon.validTo)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar"
            className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--bg)] hover:text-[color:var(--fg)]"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Eliminar"
            className="grid size-9 place-items-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--color-tomato-500)]/10 hover:text-[color:var(--color-tomato-600)]"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ============== Form ==============

function CouponForm({
  coupon,
  onDone,
}: {
  coupon: Coupon | null;
  onDone: () => void;
}) {
  const [state, action] = useActionState(upsertCouponAction, initial);
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENTAGE");
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl border border-[color:var(--line)] bg-[color:var(--card)] p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">
          {coupon ? `Editar: ${coupon.code}` : "Nuevo cupón"}
        </h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="Cerrar"
          className="grid size-8 place-items-center rounded-full hover:bg-[color:var(--bg)]"
        >
          <X className="size-4" />
        </button>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-tomato-500)]/30 bg-[color:var(--color-tomato-500)]/10 px-3 py-2 text-xs text-[color:var(--color-tomato-700)]"
        >
          {state.error}
        </p>
      )}

      {coupon && <input type="hidden" name="id" value={coupon.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Código"
          name="code"
          placeholder="VUELVE10"
          defaultValue={coupon?.code ?? ""}
          error={fe.code}
          required
          hint="Sólo MAYÚSCULAS, números, - y _"
          uppercase
        />
        <SelectField
          label="Tipo"
          name="type"
          value={type}
          onChange={(v) => setType(v as CouponType)}
          options={[
            { value: "PERCENTAGE", label: "Porcentaje" },
            { value: "FIXED_AMOUNT", label: "Monto fijo (Bs)" },
            { value: "FREE_SHIPPING", label: "Envío gratis" },
          ]}
          error={fe.type}
          required
        />
      </div>

      <Field
        label="Descripción interna (opcional)"
        name="description"
        placeholder="Para clientes que vuelven después de 30 días"
        defaultValue={coupon?.description ?? ""}
        error={fe.description}
        hint="Para que recuerdes qué hace este cupón. El cliente no la ve."
      />

      {type !== "FREE_SHIPPING" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={type === "PERCENTAGE" ? "Porcentaje %" : "Monto Bs"}
            name="value"
            type="number"
            inputMode="decimal"
            defaultValue={coupon?.value ?? ""}
            error={fe.value}
            required
            hint={
              type === "PERCENTAGE"
                ? "Entre 1 y 100"
                : "Cuánto descuenta"
            }
          />
          <Field
            label="Mínimo del pedido (opcional)"
            name="minOrderAmount"
            inputMode="decimal"
            placeholder="50"
            defaultValue={coupon?.minOrderAmount ?? ""}
            error={fe.minOrderAmount}
            hint="Subtotal mínimo en Bs."
          />
          {type === "PERCENTAGE" && (
            <Field
              label="Descuento máximo Bs (opcional)"
              name="maxDiscountAmount"
              inputMode="decimal"
              placeholder="100"
              defaultValue={coupon?.maxDiscountAmount ?? ""}
              error={fe.maxDiscountAmount}
              hint="Cap del descuento aún con %."
            />
          )}
        </div>
      )}

      {type === "FREE_SHIPPING" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Mínimo del pedido (opcional)"
            name="minOrderAmount"
            inputMode="decimal"
            placeholder="50"
            defaultValue={coupon?.minOrderAmount ?? ""}
            error={fe.minOrderAmount}
          />
          <Field
            label="Tope del envío cubierto (opcional)"
            name="maxDiscountAmount"
            inputMode="decimal"
            placeholder="20"
            defaultValue={coupon?.maxDiscountAmount ?? ""}
            error={fe.maxDiscountAmount}
            hint="Si el envío cuesta más, el cliente paga la diferencia."
          />
          {/* FREE_SHIPPING no usa `value` pero el schema lo exige > 0. Lo
              mandamos como string en hidden — la action lo ignora. */}
          <input type="hidden" name="value" value="0.01" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Límite total de usos (opcional)"
          name="usageLimit"
          type="number"
          placeholder="100"
          defaultValue={coupon?.usageLimit != null ? String(coupon.usageLimit) : ""}
          error={fe.usageLimit}
          hint="Cuántas veces se puede usar en toda la tienda."
        />
        <Field
          label="Usos por cliente (opcional)"
          name="usageLimitPerUser"
          type="number"
          placeholder="1"
          defaultValue={
            coupon?.usageLimitPerUser != null
              ? String(coupon.usageLimitPerUser)
              : ""
          }
          error={fe.usageLimitPerUser}
          hint="Cuántas veces lo puede usar el MISMO cliente."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Válido desde"
          name="validFrom"
          type="datetime-local"
          defaultValue={
            coupon?.validFrom ? toLocalInput(coupon.validFrom) : ""
          }
          error={fe.validFrom}
          required
        />
        <Field
          label="Válido hasta"
          name="validTo"
          type="datetime-local"
          defaultValue={coupon?.validTo ? toLocalInput(coupon.validTo) : ""}
          error={fe.validTo}
          required
        />
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={coupon?.isActive ?? true}
          className="size-4 rounded border-[color:var(--line-strong)]"
        />
        Cupón activo
      </label>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-4 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)]"
        >
          Cancelar
        </button>
        <SubmitButton shape="pill" size="sm">Guardar</SubmitButton>
      </div>
    </form>
  );
}

// ============== Helpers UI ==============

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  error,
  required,
  hint,
  uppercase,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  uppercase?: boolean;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}{" "}
        {required && (
          <span className="text-[color:var(--color-tomato-500)]">*</span>
        )}
      </span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue}
        style={uppercase ? { textTransform: "uppercase" } : undefined}
        className={`mt-1 w-full rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
      />
      {error ? (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">
        {label}{" "}
        {required && (
          <span className="text-[color:var(--color-tomato-500)]">*</span>
        )}
      </span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-xl border ${
          error
            ? "border-[color:var(--color-tomato-500)]"
            : "border-[color:var(--line-strong)]"
        } bg-[color:var(--bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-amber-400)]`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}

// ============== Helpers de fecha ==============

// Renderiza el instante guardado como hora-pared BOLIVIA (no la TZ del
// browser): el server parsea el datetime-local como hora Bolivia
// (parseBoliviaDateTime), así que el form debe mostrarlo en la misma
// referencia o el round-trip editar→guardar corre la ventana de vigencia.
function toLocalInput(iso: string): string {
  const b = inBolivia(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${b.year}-${pad(b.month + 1)}-${pad(b.day)}T${pad(b.hours)}:${pad(b.minutes)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isLiveNow(c: Coupon): boolean {
  if (!c.isActive) return false;
  const now = new Date();
  if (new Date(c.validFrom) > now) return false;
  if (new Date(c.validTo) < now) return false;
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return false;
  return true;
}
