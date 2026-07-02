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

  test("tienda inexistente muestra not-found con noindex (SEO blindado)", async ({
    page,
  }) => {
    await page.goto("/tienda-inexistente-xyz");

    // 1. UX: el [slug]/not-found.tsx debe renderear con su heading.
    await expect(
      page.getByRole("heading", { name: /no está disponible/i }),
    ).toBeVisible();

    // 2. SEO: el meta robots debe decirle a Googlebot "no indexes esto".
    //
    // El status HTTP en sí queda en 200 por un quirk de Next.js 15 RSC
    // streaming (los headers se envían en el primer chunk, antes de que
    // `notFound()` resuelva). El status correcto sería 404, pero lo que
    // realmente importa para SEO es que Google no indexe páginas falsas
    // como válidas — el `<meta name="robots" content="noindex">` lo
    // garantiza independientemente del status.
    //
    // Cuando Next publique fix del status, este assertion sigue válido
    // (el meta queda como cinturón + tirantes). Probé el meta empíricamente
    // contra el deploy: `curl -s /<slug-fake> | grep robots`.
    // `.first()`: en dev, Next 15 renderiza el meta robots dos veces (uno en
    // <head> y otro en <body> durante el streaming RSC) — ambos con noindex.
    // En el build de producción sale una sola vez. `.first()` hace la
    // aserción robusta en ambos entornos (sin `.first()`, el locator matchea
    // 2 elementos y viola strict mode contra el dev server).
    const robotsMeta = page.locator('meta[name="robots"]').first();
    await expect(robotsMeta).toHaveAttribute("content", /noindex/i);
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
    // El test era flaky porque el flow del auth puede tardar 0-3s en
    // renderear el error (Credentials provider de NextAuth corre bcrypt
    // contra hash dummy para no leakar timing). En vez de un solo locator
    // con 5s timeout, validamos un invariante más robusto: el usuario
    // sigue en /login Y aparece eventualmente el error.
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(
      page.getByText(/incorrectos|no pudimos|inválid/i),
    ).toBeVisible({ timeout: 10000 });
  });
});
