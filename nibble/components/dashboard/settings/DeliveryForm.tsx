"use client";

import { useActionState } from "react";
import type { Store } from "@prisma/client";
import { updateDeliveryAction } from "@/server/actions/store-settings";
import type { ActionState } from "@/lib/validation/actionState";
import {
  SectionShell,
  StatusBadge,
  TextInput,
  ToggleField,
} from "./SectionShell";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

export function DeliveryForm({ store }: { store: Store }) {
  const [state, action] = useActionState(updateDeliveryAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <SectionShell
        id="delivery"
        title="Delivery y recojo"
        description="Cómo entregas los pedidos y cuánto cobras por el envío."
        status={<StatusBadge ok={state.ok} error={state.error} />}
      >
        <ToggleField
          name="deliveryEnabled"
          label="Hago delivery"
          description="Llevas los pedidos a domicilio."
          defaultChecked={store.deliveryEnabled}
          error={fe.deliveryEnabled}
        />

        <ToggleField
          name="pickupEnabled"
          label="Recojo en local"
          description="El cliente viene a buscar el pedido."
          defaultChecked={store.pickupEnabled}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            name="defaultDeliveryFee"
            label="Tarifa de delivery por defecto (Bs)"
            defaultValue={store.defaultDeliveryFee?.toString() ?? ""}
            placeholder="10"
            inputMode="decimal"
            hint="Si configuras zonas más adelante, se usa la tarifa de la zona."
            error={fe.defaultDeliveryFee}
          />
          <TextInput
            name="freeDeliveryAbove"
            label="Delivery gratis arriba de (Bs)"
            defaultValue={store.freeDeliveryAbove?.toString() ?? ""}
            placeholder="150"
            inputMode="decimal"
            hint="Deja vacío si no aplicas esta promo."
            error={fe.freeDeliveryAbove}
          />
        </div>

        <TextInput
          name="deliveryNote"
          label="Nota visible al cliente"
          defaultValue={store.deliveryNote}
          placeholder="Costo final se confirma por WhatsApp"
          hint="Aparece debajo del costo en el checkout."
          error={fe.deliveryNote}
          maxLength={200}
        />

        <SubmitButton />
      </SectionShell>
    </form>
  );
}
