import { test, expect } from "@playwright/test";

/**
 * Smoke E2E del storefront público (no requiere auth).
 *
 * Pre-req: `npm run db:seed` con las 5 tiendas demo activas.
 */

test.describe("Storefront público", () => {
  test("landing carga y linkea al directorio", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Madriguera Shop/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // CTA al registro
    await expect(page.getByRole("link", { name: /empezar/i }).first()).toBeVisible();
  });

  test("directorio muestra al menos una tienda", async ({ page }) => {
    await page.goto("/tiendas");
    await expect(page.getByRole("heading", { name: /tiendas/i })).toBeVisible();
    // Big Bite Wings es del seed
    await expect(page.getByText("Big Bite Wings")).toBeVisible();
  });

  test("storefront de Big Bite Wings carga con productos", async ({ page }) => {
    await page.goto("/big-bite-wings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Al menos un producto visible
    await expect(page.getByText(/Wings Clásicos|Buffalo Hot/i).first()).toBeVisible();
  });

  test("detalle de producto carga", async ({ page }) => {
    await page.goto("/big-bite-wings/p/wings-clasicos-bbq");
    await expect(page.getByRole("heading", { name: /Wings Clásicos BBQ/i })).toBeVisible();
    await expect(page.getByText(/Bs/i).first()).toBeVisible();
  });

  test("404 para tienda inexistente", async ({ page }) => {
    const res = await page.goto("/tienda-inexistente-xyz");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/no está disponible|no encontrada/i)).toBeVisible();
  });
});

test.describe("Flujo de registro", () => {
  test("la página de registro carga", async ({ page }) => {
    await page.goto("/registro");
    await expect(page.getByRole("heading", { name: /tu tienda en 5 minutos/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Big Bite Wings/i)).toBeVisible();
  });

  test("validación previene submit vacío", async ({ page }) => {
    await page.goto("/registro");
    await page.getByRole("button", { name: /crear mi tienda/i }).click();
    // Algún field error debe aparecer
    await expect(page.locator("[role=alert]").first()).toBeVisible();
  });
});

test.describe("Login", () => {
  test("la página de login carga", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /bienvenido/i })).toBeVisible();
  });

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/diego@bigbite/i).fill("noexiste@example.com");
    await page.getByPlaceholder(/••••••/).fill("wrongpassword123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/incorrectos|no pudimos/i)).toBeVisible();
  });
});
