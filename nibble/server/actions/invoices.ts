"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  requireOwnerOnlyIds,
  requireSuperAdminOrFail,
} from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rateLimit";
import { sendEmailBackground } from "@/lib/email/send";
import { invoicePaidEmail } from "@/lib/email/templates/invoice-issued";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import {
  INVALID_INPUT_ERROR,
  type ActionState,
} from "@/lib/validation/actionState";
import { isAcceptedProofUrl } from "@/lib/storage/blob";

// ============== Owner: subir comprobante ==============

const uploadProofSchema = z.object({
  invoiceId: z.string().min(1),
  // Restringir a URLs internas del upload endpoint. Sin esto, un owner
  // podía mandar una URL externa apuntando a contenido controlado por él
  // que dijera "pagué BOB X", y el super-admin verificaba la factura
  // basándose en evidencia falsa.
  proofUrl: z
    .string()
    .trim()
    .min(1, "Sube el comprobante antes de enviar")
    .max(2048)
    .refine(isAcceptedProofUrl, "Comprobante inválido. Súbelo de nuevo desde el botón."),
});

export async function uploadInvoiceProofAction(
  _prev: ActionState<"proofUrl">,
  formData: FormData,
): Promise<ActionState<"proofUrl">> {
  const { userId, storeId, role } = await requireOwnerOnlyIds();

  const parsed = uploadProofSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    proofUrl: formData.get("proofUrl"),
  });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<"proofUrl">(parsed.error) };
  }

  const invoice = await db.invoice.findFirst({
    where: { id: parsed.data.invoiceId, storeId },
    select: { id: true, status: true },
  });
  if (!invoice) return { error: "Factura no encontrada" };
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return { error: "Esta factura ya fue procesada." };
  }

  await db.invoice.update({
    where: { id: invoice.id },
    data: { paidProofUrl: parsed.data.proofUrl },
  });

  await audit({
    action: "invoice.proof_uploaded",
    target: invoice.id,
    actorId: userId,
    actorRole: role,
    storeId,
  });

  revalidatePath("/dashboard/facturacion");
  revalidatePath("/admin/cobranzas");
  return { ok: true };
}

// ============== Admin: verificar pago ==============

const verifySchema = z.object({
  invoiceId: z.string().min(1),
});

export async function verifyInvoicePaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await requireSuperAdminOrFail(
    "Sólo el super admin puede verificar pagos",
  );
  if ("error" in guard) return { error: guard.error };

  // Rate limit por admin: la acción mueve dinero real y se invoca con un
  // click — sin throttle un click rápido o un script accidental podía
  // disparar verificaciones repetidas (la lógica es idempotente, pero
  // el spam ensucia logs y aumenta carga del SIN si se conecta más adelante).
  const rl = await rateLimit(`invoice:verify:${guard.id}`, 20, 60_000);
  if (!rl.success) {
    return { error: "Demasiados intentos. Espera unos segundos." };
  }

  const parsed = verifySchema.safeParse({ invoiceId: formData.get("invoiceId") });
  if (!parsed.success) return { error: INVALID_INPUT_ERROR };

  const invoice = await db.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: {
      id: true,
      status: true,
      storeId: true,
      invoiceNumber: true,
      amount: true,
      paidProofUrl: true,
      store: { select: { name: true } },
    },
  });
  if (!invoice) return { error: "Factura no encontrada" };
  if (invoice.status === "PAID") return { error: "Ya fue marcada como pagada." };
  if (!invoice.paidProofUrl) {
    return {
      error: "Esta factura no tiene comprobante adjunto. El owner debe subirlo primero.",
    };
  }

  const now = new Date();

  // Claim atómico: `updateMany` con `status: { not: "PAID" }` evita que dos
  // clicks rápidos de "Verificar" del mismo admin (o de dos admins) sobre la
  // misma factura ejecuten la lógica dos veces y se pisen `verifiedAt` /
  // `verifiedById`. El segundo update devuelve `count: 0` y abortamos.
  const claimed = await db.$transaction(async (tx) => {
    const claim = await tx.invoice.updateMany({
      where: { id: invoice.id, status: { not: "PAID" } },
      data: {
        status: "PAID",
        paidAt: now,
        verifiedAt: now,
        verifiedById: guard.id,
      },
    });
    if (claim.count === 0) return false;

    // Si la tienda no tiene más invoices pendientes/vencidas, reactivar
    const stillOpen = await tx.invoice.count({
      where: {
        storeId: invoice.storeId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
    });
    if (stillOpen === 0) {
      await tx.store.updateMany({
        where: { id: invoice.storeId, status: { in: ["PAST_DUE", "SUSPENDED"] } },
        data: {
          status: "ACTIVE",
          suspendedAt: null,
          suspendedReason: null,
        },
      });
    }
    return true;
  });

  if (!claimed) {
    return { error: "Esta factura ya fue verificada por otro admin." };
  }

  await audit({
    action: "invoice.payment.verified",
    actorId: guard.id,
    actorRole: "SUPER_ADMIN",
    target: invoice.id,
    storeId: invoice.storeId,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
    },
  });

  // Email al owner — fire-and-forget
  const owner = await db.user.findFirst({
    where: { storeId: invoice.storeId, role: Role.STORE_OWNER, email: { not: null } },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  if (owner?.email) {
    sendEmailBackground(
      invoicePaidEmail({
        to: owner.email,
        storeName: invoice.store.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
      }),
    );
  }

  revalidatePath("/dashboard/facturacion");
  revalidatePath("/admin/cobranzas");
  return { ok: true };
}

// ============== Admin: cancelar factura ==============

const cancelSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
});

export async function cancelInvoiceAction(
  _prev: ActionState<"reason">,
  formData: FormData,
): Promise<ActionState<"reason">> {
  const guard = await requireSuperAdminOrFail(
    "Sólo el super admin puede cancelar facturas",
  );
  if ("error" in guard) return { error: guard.error };

  const parsed = cancelSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { fieldErrors: zodIssuesToFieldErrors<"reason">(parsed.error) };
  }

  const invoice = await db.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: { id: true, status: true, storeId: true, invoiceNumber: true },
  });
  if (!invoice) return { error: "Factura no encontrada" };
  if (invoice.status === "PAID") {
    return { error: "No se puede cancelar una factura ya pagada." };
  }
  if (invoice.status === "CANCELLED") {
    return { error: "Esta factura ya está cancelada." };
  }

  // Cancelar la invoice y, si la tienda quedó sin facturas pendientes/vencidas,
  // reactivarla. Sin esto, la tienda queda SUSPENDED hasta el próximo cron.
  //
  // Claim atómico: `updateMany` con `status: { notIn: [...] }` actúa como
  // test-and-set. Si dos admins clickean "Cancelar" simultáneamente sobre
  // la misma factura, solo uno tiene `count === 1`. Sin esto, ambos
  // ejecutaban el update + el conteo de `stillOpen` y disparaban dos
  // intentos de reactivación de la tienda.
  let cancelled = false;
  await db.$transaction(async (tx) => {
    const claimed = await tx.invoice.updateMany({
      where: {
        id: invoice.id,
        status: { notIn: ["PAID", "CANCELLED"] },
      },
      data: { status: "CANCELLED", notes: parsed.data.reason },
    });
    if (claimed.count === 0) {
      // Otro admin la procesó entre el find y el update — salimos sin tocar
      // la tienda. No hace falta retornar error: el resultado final
      // (factura cancelada) es lo que ambos querían.
      return;
    }
    cancelled = true;

    const stillOpen = await tx.invoice.count({
      where: {
        storeId: invoice.storeId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
    });
    if (stillOpen === 0) {
      await tx.store.updateMany({
        where: {
          id: invoice.storeId,
          status: { in: ["PAST_DUE", "SUSPENDED"] },
        },
        data: {
          status: "ACTIVE",
          suspendedAt: null,
          suspendedReason: null,
        },
      });
    }
  });
  if (!cancelled) {
    return { error: "Esta factura ya fue procesada por otro admin." };
  }

  await audit({
    storeId: invoice.storeId,
    action: "invoice.cancelled",
    actorId: guard.id,
    actorRole: "SUPER_ADMIN",
    target: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, reason: parsed.data.reason },
  });

  revalidatePath("/dashboard/facturacion");
  revalidatePath("/admin/cobranzas");
  return { ok: true };
}
