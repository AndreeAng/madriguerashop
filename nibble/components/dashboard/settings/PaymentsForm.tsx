"use client";

import { useActionState } from "react";
import type { Store } from "@prisma/client";
import { updatePaymentsAction } from "@/server/actions/store-settings";
import type { ActionState } from "@/lib/validation/actionState";
import {
  SectionShell,
  StatusBadge,
  TextArea,
  ToggleField,
} from "./SectionShell";
import { ImageUploadField } from "@/components/dashboard/shared/ImageUploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

export function PaymentsForm({ store }: { store: Store }) {
  const [state, action] = useActionState(updatePaymentsAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <SectionShell
        id="pagos"
        title="Pagos"
        description="Cómo te paga el cliente. Sube tu QR del banco — el comprobante lo apruebas tú."
        status={<StatusBadge ok={state.ok} error={state.error} />}
      >
        <ToggleField
          name="acceptsQR"
          label="Acepto pago con QR"
          description="El cliente paga con QR de tu banco y sube el comprobante."
          defaultChecked={store.acceptsQR}
          error={fe.acceptsCashOnDelivery /* error grupal va acá por path */}
        />

        <ToggleField
          name="acceptsCashOnDelivery"
          label="Acepto pago en efectivo a la entrega"
          description="El cliente paga al recibir el pedido."
          defaultChecked={store.acceptsCashOnDelivery}
        />

        <ImageUploadField
          name="qrImageUrl"
          label="Tu QR"
          kind="qr"
          initialUrl={store.qrImageUrl}
          hint="Subí la captura del QR de tu banco. Ideal: alta resolución."
          error={fe.qrImageUrl}
          aspect="square"
        />

        <TextArea
          name="qrInstructions"
          label="Instrucciones para el cliente"
          defaultValue={store.qrInstructions}
          placeholder="Escaneá el QR, pagá el monto exacto y sube el comprobante. Confirmamos en máximo 5 min."
          rows={3}
          maxLength={1000}
          error={fe.qrInstructions}
        />

        <SubmitButton />
      </SectionShell>
    </form>
  );
}
