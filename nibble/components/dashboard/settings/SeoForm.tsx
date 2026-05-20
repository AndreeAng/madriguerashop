"use client";

import { useActionState } from "react";
import type { Store } from "@prisma/client";
import { updateSeoAction } from "@/server/actions/store-settings";
import type { ActionState } from "@/lib/validation/actionState";
import {
  SectionShell,
  StatusBadge,
  TextArea,
  TextInput,
} from "./SectionShell";
import { ImageUploadField } from "@/components/dashboard/shared/ImageUploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ActionState = {};

export function SeoForm({ store }: { store: Store }) {
  const [state, action] = useActionState(updateSeoAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <SectionShell
        id="seo"
        title="SEO y compartir"
        description="Cómo se ve tu tienda cuando alguien comparte tu link en WhatsApp o Google."
        status={<StatusBadge ok={state.ok} error={state.error} />}
      >
        <TextInput
          name="metaTitle"
          label="Título SEO"
          defaultValue={store.metaTitle}
          placeholder={`${store.name} · ${store.city ?? ""}`}
          hint="Aparece en la pestaña del navegador y en Google. Máx. 70 caracteres."
          error={fe.metaTitle}
          maxLength={70}
        />

        <TextArea
          name="metaDescription"
          label="Descripción SEO"
          defaultValue={store.metaDescription}
          placeholder="Wings que no te dejan parar. Pide por WhatsApp, pagamos con QR."
          hint="Aparece debajo del título en Google. Máx. 160 caracteres."
          rows={2}
          error={fe.metaDescription}
          maxLength={160}
        />

        <TextInput
          name="metaKeywords"
          label="Palabras clave (separadas por coma)"
          defaultValue={store.metaKeywords}
          placeholder="wings, alitas, comida rápida, cochabamba, delivery"
          error={fe.metaKeywords}
          maxLength={200}
        />

        <ImageUploadField
          name="ogImageUrl"
          label="Imagen al compartir (Open Graph)"
          kind="banner"
          initialUrl={store.ogImageUrl}
          hint="La que aparece cuando compartís tu link en WhatsApp/Facebook (1200×630)."
          error={fe.ogImageUrl}
          aspect="wide"
        />

        <SubmitButton />
      </SectionShell>
    </form>
  );
}
