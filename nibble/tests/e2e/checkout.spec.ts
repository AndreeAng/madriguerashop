import { test, expect, type Page } from "@playwright/test";

/**
 * E2E del flujo de checkout completo — el camino del dinero.
 *
 * Recorre: producto → agregar al carrito → checkout → datos → pickup →
 * pago contra entrega → confirmar. Ejercita toda la cadena real:
 * FormData → createOrderAction → recálculo server-side de precios
 * (computeOrderPricing) → transacción → creación de la orden en DB.
 *
 * Pre-req: `npm run db:seed` con la tienda demo `big-bite-wings` activa
 * (acepta efectivo + pickup, abierta 11:00–23:00 BOT, cupón WINGS10).
 *
 * DETERMINISMO HORARIO: la tienda demo abre 11:00–23:00 hora Bolivia y
 * el CI corre en UTC a cualquier hora — un pedido "lo antes posible"
 * fuera de ese rango se rechaza con "tienda cerrada" y este suite era
 * rojo media jornada. Por eso SIEMPRE programamos el pedido para mañana
 * a las 18:00 hora del browser: en CI (UTC) eso es 14:00 BOT y en una
 * máquina boliviana es 18:00 BOT — dentro del horario en ambos casos.
 */

/** Mañana a las 18:00 en formato datetime-local (hora del browser). */
function tomorrowAt18(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

/** Producto → checkout → datos + pickup + programación. Deja listo para
 *  elegir pago/cupón y confirmar. */
async function startCheckout(page: Page, phone: string) {
  // El handler de éxito abre WhatsApp en una pestaña nueva (window.open).
  // Lo neutralizamos para que la navegación externa a wa.me no interfiera.
  await page.addInitScript(() => {
    window.open = () => null;
  });

  await page.goto("/big-bite-wings/p/wings-clasicos-bbq");
  await page.getByRole("button", { name: /Agregar/i }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // Resumen del pedido visible con el subtotal del producto.
  await expect(page.getByText(/Bs\s*35/).first()).toBeVisible();

  // Pickup — evita dirección + mapa de delivery.
  await page.getByRole("button", { name: /Recoger en local/i }).click();

  await page.getByPlaceholder("Carla Mendoza").fill("Test Cliente E2E");
  await page.getByPlaceholder("72345678").fill(phone);

  // Programar SIEMPRE (ver nota de determinismo arriba). Si la tienda está
  // abierta hay que elegir el chip "Programar"; si está cerrada, el picker
  // ya viene forzado en modo programado.
  const programar = page.getByRole("button", { name: /^Programar$/i });
  if (await programar.isVisible().catch(() => false)) {
    await programar.click();
  }
  await page.locator('input[type="datetime-local"]').fill(tomorrowAt18());
}

/** Confirma y verifica que el checkout terminó (sale de /checkout). */
async function confirmAndExpectSuccess(page: Page) {
  await page.getByRole("button", { name: /Confirmar y avisar/i }).click();
  // Un checkout EXITOSO borra el carrito y deja la página de checkout —
  // sea a la página de tracking (router.push) o al storefront (el
  // redirect por carrito vacío del checkout server component). Un error
  // de validación/servidor mantendría al usuario en /checkout con un
  // alert; por eso "salir de /checkout" es prueba robusta de éxito.
  await expect(page).not.toHaveURL(/\/checkout/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/big-bite-wings/);
}

test.describe("Checkout", () => {
  test("pickup + efectivo programado crea la orden y sale del checkout", async ({ page }) => {
    await startCheckout(page, "72345678");
    await page.getByRole("button", { name: /Contra entrega/i }).click();
    await confirmAndExpectSuccess(page);
  });

  test("cupón WINGS10 se aplica ANTES de pagar y descuenta el 10%", async ({ page }) => {
    await startCheckout(page, "72345679");

    // Cupón inválido primero: el preview debe rechazarlo sin crear nada.
    await page.getByPlaceholder("BIENVENIDO10").fill("NOEXISTE");
    await page.getByRole("button", { name: /^Aplicar$/i }).click();
    await expect(page.getByText(/Cupón inválido/i)).toBeVisible();

    // Cupón real: 10% sobre Bs 35 → total Bs 31,50 visible en el resumen
    // ANTES de confirmar (es lo que un cliente QR necesita para transferir
    // el monto exacto).
    await page.getByPlaceholder("BIENVENIDO10").fill("WINGS10");
    await page.getByRole("button", { name: /^Aplicar$/i }).click();
    await expect(page.getByText(/aplicado/i).first()).toBeVisible();
    await expect(page.getByText(/31[.,]50/).first()).toBeVisible();

    await page.getByRole("button", { name: /Contra entrega/i }).click();
    await confirmAndExpectSuccess(page);
  });
});
