import { describe, it, expect } from "vitest";
import { escapeHtml, safeSubjectField, renderEmail } from "@/lib/email/layout";

/**
 * Helpers compartidos por todos los emails. Dos son de SEGURIDAD:
 *   - escapeHtml: evita inyección de HTML/JS en el cuerpo del email
 *     (customerName, storeName, notas del cliente van al HTML).
 *   - safeSubjectField: evita header injection (un \r\n en el Subject puede
 *     inyectar Bcc/To y convertir el SMTP en relay de spam).
 */

describe("escapeHtml", () => {
  it("escapa los 5 caracteres peligrosos", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("neutraliza un intento de inyección de <script>", () => {
    const out = escapeHtml("<script>alert('xss')</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("deja el texto plano intacto", () => {
    expect(escapeHtml("Café del Barrio")).toBe("Café del Barrio");
  });

  it("escapa el & primero (no produce doble-escape roto)", () => {
    // "&lt;" de entrada → "&amp;lt;", no "&amp;amp;lt;".
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("safeSubjectField", () => {
  it("reemplaza CR/LF/TAB por espacio (bloquea header injection)", () => {
    const out = safeSubjectField("Juan\r\nBcc: evil@x.com");
    expect(out).not.toMatch(/[\r\n\t]/);
    expect(out).toBe("Juan Bcc: evil@x.com");
  });

  it("colapsa secuencias de whitespace de control en un solo espacio", () => {
    expect(safeSubjectField("a\r\n\tb")).toBe("a b");
  });

  it("hace trim de los extremos", () => {
    expect(safeSubjectField("  hola  ")).toBe("hola");
  });

  it("trunca al maxLen (default 100, y custom)", () => {
    expect(safeSubjectField("x".repeat(150))).toHaveLength(100);
    expect(safeSubjectField("x".repeat(50), 40)).toHaveLength(40);
  });
});

describe("renderEmail", () => {
  it("produce un documento HTML completo", () => {
    const html = renderEmail({ title: "Hola", body: "<p>cuerpo</p>" });
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("escapa el título pero inserta el body RAW (contrato del layout)", () => {
    const html = renderEmail({ title: "<b>t</b>", body: "<p>cuerpo literal</p>" });
    expect(html).toContain("&lt;b&gt;t&lt;/b&gt;"); // título escapado
    expect(html).toContain("<p>cuerpo literal</p>"); // body sin tocar
  });

  it("incluye el CTA solo cuando hay ctaText Y ctaUrl", () => {
    const withCta = renderEmail({
      title: "T",
      body: "b",
      ctaText: "Ir al panel",
      ctaUrl: "https://app.madrigueras.shop/x",
    });
    expect(withCta).toContain("Ir al panel");
    expect(withCta).toContain("https://app.madrigueras.shop/x");

    const noCta = renderEmail({ title: "T", body: "b" });
    expect(noCta).not.toContain("<a href");
  });

  it("usa el footnote por defecto si no se pasa", () => {
    const html = renderEmail({ title: "T", body: "b" });
    expect(html).toContain("Madriguera Shop");
  });
});
