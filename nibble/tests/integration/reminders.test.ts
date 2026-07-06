import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { sendInvoiceReminders } from "@/lib/billing/sendReminders";

/**
 * Lógica de recordatorios de factura (`sendInvoiceReminders`). El envío real
 * es fire-and-forget y sin SMTP no hace nada, así que verificamos la DECISIÓN:
 * qué invoices disparan reminder (3d/1d antes, día D, y overdue en 1/3/6...),
 * el throttle de 20h, el cap de 5, y el caso sin email del owner.
 *
 * Usamos `now` en 2029 (lejos de otras fixtures) para que la ventana de
 * búsqueda (-30d..+5d) no incluya invoices de otros tests.
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const SLUG = `test-remind-${STAMP}`;
const SLUG_NOEMAIL = `test-remind-noemail-${STAMP}`;
const NOW = new Date("2029-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

let storeId: string;
let storeNoEmailId: string;
let idx = 0;

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst();
  if (!template || !plan) throw new Error("Test DB sin template/plan (correr seed).");

  const store = await prisma.store.create({
    data: {
      slug: SLUG,
      name: "Test Reminders",
      vertical: "RETAIL",
      templateId: template.id,
      planId: plan.id,
      whatsappPhone: "+59170000000",
    },
  });
  storeId = store.id;
  // Owner CON email — requisito para que se dispare el reminder.
  await prisma.user.create({
    data: {
      username: `owner-remind-${STAMP}`,
      email: `owner-remind-${STAMP}@example.bo`,
      passwordHash: "x",
      role: "STORE_OWNER",
      storeId,
    },
  });

  // Segunda tienda SIN owner con email.
  const store2 = await prisma.store.create({
    data: {
      slug: SLUG_NOEMAIL,
      name: "Test Reminders Sin Email",
      vertical: "RETAIL",
      templateId: template.id,
      planId: plan.id,
      whatsappPhone: "+59170000000",
    },
  });
  storeNoEmailId = store2.id;
});

afterAll(async () => {
  await prisma.invoice.deleteMany({ where: { storeId: { in: [storeId, storeNoEmailId] } } });
  await prisma.user.deleteMany({ where: { storeId: { in: [storeId, storeNoEmailId] } } });
  await prisma.store.deleteMany({ where: { id: { in: [storeId, storeNoEmailId] } } });
  await prisma.$disconnect();
});

async function makeInvoice(opts: {
  store: string;
  dueOffsetDays: number;
  status?: "PENDING" | "OVERDUE";
  reminderSentAt?: Date | null;
  remindersCount?: number;
}) {
  idx += 1;
  return prisma.invoice.create({
    data: {
      invoiceNumber: `REM-${STAMP}-${idx}`,
      storeId: opts.store,
      amount: 199,
      periodStart: new Date(Date.UTC(2029, 4, idx)), // único por invoice
      periodEnd: new Date(Date.UTC(2029, 5, idx)),
      dueDate: new Date(NOW.getTime() + opts.dueOffsetDays * DAY),
      status: opts.status ?? "PENDING",
      reminderSentAt: opts.reminderSentAt ?? null,
      remindersCount: opts.remindersCount ?? 0,
    },
  });
}

describe("sendInvoiceReminders — decisión de envío", () => {
  it("envía / omite según los días al vencimiento, throttle, cap y email", async () => {
    // A: vence en 3 días → envía (due_soon)
    const a = await makeInvoice({ store: storeId, dueOffsetDays: 3 });
    // B: vence en 2 días → NO es día de reminder
    const b = await makeInvoice({ store: storeId, dueOffsetDays: 2 });
    // C: vencida hace 1 día → envía (overdue)
    const c = await makeInvoice({ store: storeId, dueOffsetDays: -1, status: "OVERDUE" });
    // D: vence en 3 días PERO se envió hace 5h → throttle, omite
    const d = await makeInvoice({
      store: storeId,
      dueOffsetDays: 3,
      reminderSentAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
    });
    // E: vence en 3 días PERO ya llegó al cap de 5 → omite
    const e = await makeInvoice({ store: storeId, dueOffsetDays: 3, remindersCount: 5 });
    // F: vence en 3 días pero la tienda no tiene email de owner → omite
    const f = await makeInvoice({ store: storeNoEmailId, dueOffsetDays: 3 });

    const res = await sendInvoiceReminders({ now: NOW });
    expect(res.candidates).toBeGreaterThanOrEqual(6);
    expect(res.sent).toBeGreaterThanOrEqual(2);

    const reload = (id: string) => prisma.invoice.findUnique({ where: { id } });

    // Enviados: reminderSentAt = NOW, count incrementado.
    const aAfter = await reload(a.id);
    expect(aAfter!.reminderSentAt?.getTime()).toBe(NOW.getTime());
    expect(aAfter!.remindersCount).toBe(1);
    const cAfter = await reload(c.id);
    expect(cAfter!.reminderSentAt?.getTime()).toBe(NOW.getTime());

    // Omitidos: reminderSentAt sin tocar.
    expect((await reload(b.id))!.reminderSentAt).toBeNull(); // no era día de reminder
    expect((await reload(d.id))!.reminderSentAt?.getTime()).toBe(
      NOW.getTime() - 5 * 60 * 60 * 1000, // throttle: quedó el valor viejo
    );
    expect((await reload(d.id))!.remindersCount).toBe(0); // no incrementó
    expect((await reload(e.id))!.remindersCount).toBe(5); // cap: sin cambios
    expect((await reload(f.id))!.reminderSentAt).toBeNull(); // sin email
  });
});
