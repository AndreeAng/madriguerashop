"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireOwnerOnlyIds } from "@/lib/auth/session";
import { sendEmailBackground } from "@/lib/email/send";
import { invoicePaidEmail } from "@/lib/email/templates/invoice-issued";
import { audit } from "@/lib/audit/log";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import type { ActionState } from "./store-settings";

// ============== Owner: subir comprobante ==============

const uploadProofSchema = z.object({
  invoiceId: z.string().min(1),
  // Restringir a paths internos del upload endpoint (mismo patrón que
  // `createOrderAction`). Sin esto, un owner podía mandar una URL externa
  // apuntando a contenido controlado por él que dijera "pagué BOB X",
  // y el super-admin verificaba la factura basándose en evidencia falsa.
  proofUrl: z
    .string()
    .trim()
    .min(1, "Sube el comprobante antes de enviar")
    .max(2048)
    .refine(
      (v) => v.startsWith("/api/uploads/proof/"),
      "Comprobante inválido. Subilo de nuevo desde el botón.",
    ),
});

export async function uploadInvoiceProofAction(
  _prev: ActionState<"proofUrl">,
  formData: FormData,
): Promise<ActionState<"proofUrl">> {
  const { storeId } = await requireOwnerOnlyIds();

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
  const session = await auth();
  if (!session?.user || session.user.role !== Role.SUPER_ADMIN) {
    return { error: "Sólo el super admin puede verificar pagos" };
  }

  const parsed = verifySchema.safeParse({ invoiceId: formData.get("invoiceId") });
  if (!parsed.success) return { error: "Datos inválidos" };

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
        verifiedById: session.user.id,
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
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    target: invoice.id,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      storeId: invoice.storeId,
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
  const session = await auth();
  if (!session?.user || session.user.role !== Role.SUPER_ADMIN) {
    return { error: "Sólo el super admin puede cancelar facturas" };
  }

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
  await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "CANCELLED", notes: parsed.data.reason },
    });

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

  await audit({
    storeId: invoice.storeId,
    action: "invoice.cancelled",
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    target: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, reason: parsed.data.reason },
  });

  revalidatePath("/dashboard/facturacion");
  revalidatePath("/admin/cobranzas");
  return { ok: true };
}
