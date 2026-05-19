"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import type { AlertStatus } from "@prisma/client";
import {
  acknowledgeAlertAction,
  resolveAlertAction,
} from "@/server/actions/admin-alerts";
import type { ActionState } from "@/lib/validation/actionState";

const initial: ActionState = {};

export function AlertActions({
  alertId,
  status,
}: {
  alertId: string;
  status: AlertStatus;
}) {
  if (status === "RESOLVED") return null;

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
      {status === "OPEN" && <AcknowledgeButton alertId={alertId} />}
      <ResolveButton alertId={alertId} />
    </div>
  );
}

function AcknowledgeButton({ alertId }: { alertId: string }) {
  const [, action] = useActionState(acknowledgeAlertAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="alertId" value={alertId} />
      <ActionBtn icon={<Check className="size-4" />} label="Reconocer" tone="amber" />
    </form>
  );
}

function ResolveButton({ alertId }: { alertId: string }) {
  const [, action] = useActionState(resolveAlertAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="alertId" value={alertId} />
      <ActionBtn
        icon={<CheckCircle2 className="size-4" />}
        label="Resolver"
        tone="leaf"
      />
    </form>
  );
}

function ActionBtn({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "amber" | "leaf";
}) {
  const { pending } = useFormStatus();
  const cls =
    tone === "amber"
      ? "border-[color:var(--color-amber-500)]/40 text-[color:var(--color-amber-700)] hover:bg-[color:var(--color-amber-500)]/10"
      : "border-[color:var(--color-leaf-500)]/40 text-[color:var(--color-leaf-700)] hover:bg-[color:var(--color-leaf-500)]/10";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
