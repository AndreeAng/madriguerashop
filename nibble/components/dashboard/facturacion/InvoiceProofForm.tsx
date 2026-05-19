"use client";

import { useActionState, useState } from "react";
import { uploadInvoiceProofAction } from "@/server/actions/invoices";
import { ImageUploadField } from "@/components/dashboard/shared/ImageUploadField";
import type { ActionState } from "@/lib/validation/actionState";
import { ErrorAlert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState<"proofUrl"> = {};

export function InvoiceProofForm({
  invoiceId,
  initialProofUrl,
}: {
  invoiceId: string;
  initialProofUrl: string | null;
}) {
  const [state, action] = useActionState(uploadInvoiceProofAction, initial);
  const [hasProof, setHasProof] = useState(Boolean(initialProofUrl));

  // Cuando el upload se confirma del lado del server, ocultamos el form para
  // evitar resubmits accidentales (la action acepta re-uploads pero la UX
  // sugiere que ya terminó).
  if (state.ok) {
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
      >
        ✓ Comprobante enviado. Lo verificamos en máximo 24 hs.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <ImageUploadField
        name="proofUrl"
        label="Comprobante de pago"
        kind="proof"
        initialUrl={initialProofUrl}
        hint="Tomá foto del comprobante de transferencia o escaneo del QR pagado."
        error={state.fieldErrors?.proofUrl}
        aspect="square"
        onChange={(url) => setHasProof(Boolean(url))}
      />

      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      <SubmitButton
        size="sm"
        disabled={!hasProof}
        pendingLabel="Enviando…"
      >
        Enviar comprobante
      </SubmitButton>
    </form>
  );
}
