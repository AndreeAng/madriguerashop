import { describe, it, expect } from "vitest";
import { trackingStepsFor, trackingStepIndex } from "@/lib/orders/status";

describe("trackingStepsFor", () => {
  it("no pide comprobante en pedidos en efectivo", () => {
    const steps = trackingStepsFor("CASH_ON_DELIVERY");
    expect(steps.some((s) => s.key === "PENDING_PAYMENT")).toBe(false);
    expect(steps.find((s) => s.key === "CONFIRMED")?.desc).not.toMatch(/pago/i);
  });

  it("mantiene el paso de pago en pedidos por QR", () => {
    const steps = trackingStepsFor("QR_STATIC");
    expect(steps[0]?.key).toBe("PENDING_PAYMENT");
  });

  it("calcula el paso actual sobre los pasos del pedido", () => {
    expect(trackingStepIndex("NEW", trackingStepsFor("CASH_ON_DELIVERY"))).toBe(0);
    expect(trackingStepIndex("NEW", trackingStepsFor("QR_STATIC"))).toBe(1);
  });
});
