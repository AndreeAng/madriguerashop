import { test, expect } from "@playwright/test";

/**
 * E2E del área autenticada del dueño — hoy sin cobertura de browser.
 *
 * Verifica el camino login → dashboard y que las vistas principales del
 * panel cargan sin romper (auth, sesión, RSC con datos reales de la tienda).
 *
 * La contraseña sale de `SEED_DEMO_OWNER_PASSWORD` (la misma que usó el seed):
 *   - En CI el job `test-e2e` la exporta.
 *   - Local: `SEED_DEMO_OWNER_PASSWORD=... npx playwright test`.
 * Si no está seteada, el test se skipea en vez de fallar con credenciales malas.
 */

const OWNER_EMAIL = "owner@bigbitewings.bo";
const OWNER_PASS = process.env.SEED_DEMO_OWNER_PASSWORD;

test.describe("Dashboard del dueño", () => {
  test.skip(!OWNER_PASS, "SEED_DEMO_OWNER_PASSWORD no seteado — skip login E2E");

  test("login del dueño entra al dashboard y carga vistas clave", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByPlaceholder(/diego@bigbite/i).fill(OWNER_EMAIL);
    await page.getByPlaceholder(/••••••/).fill(OWNER_PASS!);
    await page.getByRole("button", { name: /entrar/i }).click();

    // Aterriza en el dashboard.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Pedidos — la vista operativa principal. (El label del heading varía por
    // vertical: "Pedidos"/"Reservas"/etc. — por eso asertamos URL + que
    // renderizó algún heading, sin acoplar al texto.)
    await page.goto("/dashboard/pedidos");
    await expect(page).toHaveURL(/\/dashboard\/pedidos/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Productos/catálogo — el heading es "Platos" en FOOD, "Productos" en
    // retail, etc. Verificamos que la vista carga, no el copy exacto.
    await page.goto("/dashboard/productos");
    await expect(page).toHaveURL(/\/dashboard\/productos/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("una ruta del dashboard sin sesión redirige a login", async ({ page }) => {
    // Sin autenticar, cualquier ruta protegida rebota a /login.
    await page.goto("/dashboard/pedidos");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
