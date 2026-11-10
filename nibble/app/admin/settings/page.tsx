import { requireSuperAdmin } from "@/lib/auth/session";
import { getSaasSettings } from "@/lib/saas/settings";
import { SaasSettingsForm } from "@/components/admin/settings/SaasSettingsForm";

export const metadata = { title: "Configuración · Admin" };

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const settings = await getSaasSettings();

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-12">
      <div>
        <h1 className="font-display text-3xl">Configuración</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Ajustes globales del SaaS. Los cambios se reflejan en todos los
          procesos en menos de 1 minuto (cache TTL).
        </p>
      </div>

      <div className="mt-8">
        <SaasSettingsForm settings={settings} />
      </div>
    </main>
  );
}
