import { describe, it, expect } from "vitest";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { emailVerificationEmail } from "@/lib/email/templates/email-verification";
import { invoiceIssuedEmail, invoicePaidEmail } from "@/lib/email/templates/invoice-issued";
import { invoiceReminderEmail, storeSuspendedEmail } from "@/lib/email/templates/invoice-reminder";
import {
  orderCreatedCustomerEmail,
  orderStatusChangedCustomerEmail,
} from "@/lib/email/templates/order";

/**
 * Los templates son funciones puras `opts → SendInput`. Verificamos que:
 *   - el `to` y el `subject` se arman con la data crítica correcta,
 *   - los links importantes (reset, verificación) llegan al HTML,
 *   - el input dinámico del subject pasa por safeSubjectField (anti-injection),
 *   - el input dinámico del body pasa por escapeHtml (anti-XSS).
 */

describe("passwordResetEmail", () => {
  it("subject fijo + el resetUrl va en el HTML", () => {
    const mail = passwordResetEmail({
      to: "user@x.com",
      resetUrl: "https://app.madrigueras.shop/reset?t=abc123",
      expiresAt: new Date("2026-06-15T12:00:00Z"),
    });
    expect(mail.to).toBe("user@x.com");
    expect(mail.subject).toBe("Restablece tu contraseña — Madriguera Shop");
    expect(mail.html).toContain("https://app.madrigueras.shop/reset?t=abc123");
  });
});

describe("emailVerificationEmail", () => {
  it("el verifyUrl va en el HTML", () => {
    const mail = emailVerificationEmail({
      to: "user@x.com",
      verifyUrl: "https://app.madrigueras.shop/verify?t=xyz",
      storeName: "Mi Tienda",
    });
    expect(mail.html).toContain("https://app.madrigueras.shop/verify?t=xyz");
  });
});

describe("welcomeEmail", () => {
  it("incluye el nombre del owner en el subject", () => {
    const mail = welcomeEmail({
      to: "o@x.com",
      ownerName: "Ana",
      storeName: "Tienda Ana",
      storeSlug: "tienda-ana",
    });
    expect(mail.subject).toContain("Ana");
  });

  it("sanitiza CR/LF del ownerName en el subject (header injection)", () => {
    const mail = welcomeEmail({
      to: "o@x.com",
      ownerName: "Ana\r\nBcc: evil@x.com",
      storeName: "T",
      storeSlug: "t",
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});

describe("invoiceIssuedEmail / invoicePaidEmail", () => {
  it("issued: el número de factura va en el subject", () => {
    const mail = invoiceIssuedEmail({
      to: "o@x.com",
      storeName: "T",
      invoiceNumber: "NIB-000042",
      amount: 199,
      dueDate: new Date("2026-06-20T12:00:00Z"),
    });
    expect(mail.subject).toContain("NIB-000042");
  });

  it("paid: devuelve un SendInput válido", () => {
    const mail = invoicePaidEmail({
      to: "o@x.com",
      storeName: "T",
      invoiceNumber: "NIB-000042",
      amount: 199,
    });
    expect(mail.to).toBe("o@x.com");
    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.html.length).toBeGreaterThan(0);
  });
});

describe("invoiceReminderEmail — subject según kind", () => {
  const base = {
    to: "o@x.com",
    storeName: "T",
    invoiceNumber: "NIB-000042",
    amount: 199,
    dueDate: new Date("2026-06-20T12:00:00Z"),
  };

  it("overdue → 'Tu factura venció'", () => {
    const mail = invoiceReminderEmail({ ...base, daysUntilDue: -2, kind: "overdue" });
    expect(mail.subject).toContain("Tu factura venció");
  });

  it("due_today → 'vence hoy'", () => {
    const mail = invoiceReminderEmail({ ...base, daysUntilDue: 0, kind: "due_today" });
    expect(mail.subject).toContain("vence hoy");
  });

  it("due_soon en 3 días → plural 'días'", () => {
    const mail = invoiceReminderEmail({ ...base, daysUntilDue: 3, kind: "due_soon" });
    expect(mail.subject).toContain("vence en 3 días");
  });

  it("due_soon en 1 día → singular 'día'", () => {
    const mail = invoiceReminderEmail({ ...base, daysUntilDue: 1, kind: "due_soon" });
    expect(mail.subject).toContain("1 día");
    expect(mail.subject).not.toContain("1 días");
  });
});

describe("storeSuspendedEmail", () => {
  it("subject fijo de suspensión", () => {
    const mail = storeSuspendedEmail({ to: "o@x.com", storeName: "T", storeSlug: "t" });
    expect(mail.subject).toBe("Tu tienda fue suspendida — Madriguera Shop");
  });
});

describe("orderCreatedCustomerEmail", () => {
  it("subject con el número de pedido; escapa el storeName en el HTML (anti-XSS)", () => {
    const mail = orderCreatedCustomerEmail({
      to: "c@x.com",
      storeName: "<script>x</script>",
      storeSlug: "t",
      orderNumber: 1234,
      trackingToken: "tok",
      total: 150,
      paymentMethod: "CASH_ON_DELIVERY",
      awaitingVerification: false,
      vertical: "RETAIL",
    });
    expect(mail.subject).toContain("#1234");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>x</script>");
  });
});

describe("orderStatusChangedCustomerEmail", () => {
  it("CONFIRMED → subject con estado y número de pedido", () => {
    const mail = orderStatusChangedCustomerEmail({
      to: "c@x.com",
      storeName: "T",
      storeSlug: "t",
      orderNumber: 77,
      trackingToken: "tok",
      newStatus: "CONFIRMED",
      vertical: "RETAIL",
    });
    expect(mail.subject).toContain("#77");
    expect(mail.subject).toContain("Confirmad");
  });

  it("CANCELLED → subject de cancelación", () => {
    const mail = orderStatusChangedCustomerEmail({
      to: "c@x.com",
      storeName: "T",
      storeSlug: "t",
      orderNumber: 77,
      trackingToken: "tok",
      newStatus: "CANCELLED",
      cancelReason: "Sin stock",
      vertical: "RETAIL",
    });
    expect(mail.subject).toContain("Cancelad");
  });
});
