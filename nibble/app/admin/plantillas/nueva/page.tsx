import { requireSuperAdmin } from "@/lib/auth/session";
import { TemplateForm } from "@/components/admin/plantillas/TemplateForm";

export const metadata = { title: "Nueva plantilla · Admin" };

export default async function NuevaPlantillaPage() {
  await requireSuperAdmin();

  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-12">
      <div>
        <h1 className="font-display text-3xl">Nueva plantilla</h1>
      </div>
      <div className="mt-8">
        <TemplateForm template={null} />
      </div>
    </main>
  );
}
