"use client";

import { useActionState, useState } from "react";
import type { Store } from "@prisma/client";
import { updateIdentityAction } from "@/server/actions/store-settings";
import type { ActionState } from "@/lib/validation/actionState";
import {
  SectionShell,
  StatusBadge,
  TextArea,
  TextInput,
} from "./SectionShell";
import { ImageUploadField } from "@/components/dashboard/shared/ImageUploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PhoneInputBO } from "@/components/shared/PhoneInputBO";

const initial: ActionState = {};

export function IdentityForm({ store }: { store: Store }) {
  const [state, action] = useActionState(updateIdentityAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <SectionShell
        id="identidad"
        title="Identidad y marca"
        description="El alma visual de tu tienda y cómo te encuentran. Cambios aplican al storefront público."
        status={<StatusBadge ok={state.ok} error={state.error} />}
      >
        <TextInput
          name="name"
          label="Nombre de la tienda"
          defaultValue={store.name}
          required
          error={fe.name}
          maxLength={60}
        />

        <TextArea
          name="description"
          label="Descripción corta"
          defaultValue={store.description}
          placeholder="Wings que no te dejan parar. 14 sabores, picante a tu medida."
          hint="Aparece en el header del storefront. Máx. 500 caracteres."
          error={fe.description}
          maxLength={500}
          rows={2}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <ColorInput
            name="primaryColor"
            label="Color primario"
            defaultValue={store.primaryColor}
            error={fe.primaryColor}
          />
          <ColorInput
            name="secondaryColor"
            label="Color secundario"
            defaultValue={store.secondaryColor}
            error={fe.secondaryColor}
          />
          <ColorInput
            name="accentColor"
            label="Color de acento"
            defaultValue={store.accentColor}
            error={fe.accentColor}
          />
        </div>

        <TextInput
          name="fontFamily"
          label="Fuente"
          defaultValue={store.fontFamily}
          hint="Cualquier fuente disponible en Google Fonts."
          error={fe.fontFamily}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <ImageUploadField
            name="logoUrl"
            label="Logo"
            kind="logo"
            initialUrl={store.logoUrl}
            error={fe.logoUrl}
            aspect="square"
          />
          <ImageUploadField
            name="bannerUrl"
            label="Banner del storefront"
            kind="banner"
            initialUrl={store.bannerUrl}
            error={fe.bannerUrl}
            aspect="wide"
            hint="Foto principal del hero (1920×1080 ideal)."
          />
          <ImageUploadField
            name="faviconUrl"
            label="Favicon"
            kind="favicon"
            initialUrl={store.faviconUrl}
            error={fe.faviconUrl}
            aspect="square"
            hint="Aparece en la pestaña del navegador."
          />
        </div>

        <div className="border-t border-[color:var(--line)] pt-5" />

        <h3 className="text-sm font-semibold">Contacto</h3>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Prefijo +591 fijo (PhoneInputBO): el owner tipea solo los 8
              dígitos, igual que sus clientes en el checkout. El defaultValue
              con prefijo se descompone solo. */}
          <PhoneInputBO
            name="whatsappPhone"
            label="WhatsApp"
            defaultValue={store.whatsappPhone}
            required
            hint="Aquí te llegan los pedidos."
            error={fe.whatsappPhone}
          />
          <TextInput
            name="email"
            label="Email"
            defaultValue={store.email}
            placeholder="hola@tutienda.bo"
            type="email"
            autoComplete="email"
            error={fe.email}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <TextInput
            name="addressText"
            label="Dirección"
            defaultValue={store.addressText}
            placeholder="Av. América Este 1234"
            error={fe.addressText}
          />
          <TextInput
            name="city"
            label="Ciudad"
            defaultValue={store.city}
            required
            error={fe.city}
          />
        </div>

        <div className="border-t border-[color:var(--line)] pt-5" />

        <h3 className="text-sm font-semibold">Redes</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            name="instagram"
            label="Instagram (usuario)"
            defaultValue={store.instagram}
            placeholder="bigbitewings"
            error={fe.instagram}
          />
          <TextInput
            name="facebook"
            label="Facebook (usuario o página)"
            defaultValue={store.facebook}
            placeholder="bigbitewings"
            error={fe.facebook}
          />
          <TextInput
            name="tiktok"
            label="TikTok (usuario)"
            defaultValue={store.tiktok}
            placeholder="bigbitewings"
            error={fe.tiktok}
          />
          <TextInput
            name="website"
            label="Sitio web"
            defaultValue={store.website}
            placeholder="https://tutienda.bo"
            error={fe.website}
          />
        </div>

        <SubmitButton />
      </SectionShell>
    </form>
  );
}

function ColorInput({
  name,
  label,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
}) {
  // Estado controlado: el color y el hex viven en React, no en el DOM. Así
  // ambos inputs siempre coinciden y el value enviado al server es el real.
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block">
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--bg)] px-3 py-2 focus-within:border-[color:var(--color-amber-400)]">
        <input
          name={name}
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`${label} (selector)`}
          className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
          }}
          aria-label={`${label} (hex)`}
          className="flex-1 bg-transparent text-sm font-mono outline-none"
          maxLength={7}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[color:var(--color-tomato-600)]">
          {error}
        </p>
      )}
    </label>
  );
}
