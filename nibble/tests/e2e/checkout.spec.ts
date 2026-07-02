import { test, expect } from "@playwright/test";

/**
 * E2E del flujo de checkout completo — el camino del dinero.
 *
 * Recorre: producto → agregar al carrito → checkout → datos → pickup →
 * pago contra entrega → confirmar. Ejercita toda la cadena real:
 * FormData → createOrderAction → recálculo server-side de precios
 * (computeOrderPricing) → transacción → creación de la orden en DB.
 *
 * Pre-req: `npm run db:seed` con la tienda demo `big-bite-wings` activa
 * (acepta efectivo + pickup, abierta 11:00–23:00).
 *
 * Elegimos pickup + efectivo a propósito: evita la dirección/mapa de
 * delivery y la subida de comprobante del QR — el flujo mínimo que igual
 * ejercita el cálculo de total, stock y persistencia.
 */

test.describe("Checkout", () => {
  test("pickup + efectivo crea la orden y sale del checkout", async ({ page }) => {
    // El handler de éxito abre WhatsApp en una pestaña nueva (window.open).
    // Lo neutralizamos para que la navegación externa a wa.me no interfiera
    // con el test — no aporta nada a lo que validamos.
    await page.addInitScript(() => {
      window.open = () => null;
    });

    // 1. Producto → "Agregar" redirige directo al checkout.
    await page.goto("/big-bite-wings/p/wings-clasicos-bbq");
    await page.getByRole("button", { name: /Agregar/i }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // Resumen del pedido visible con el subtotal del producto.
    await expect(page.getByText(/Bs\s*35/).first()).toBeVisible();

    // 2. Recoger en local — evita dirección + mapa de delivery.
    await page.getByRole("button", { name: /Recoger en local/i }).click();

    // 3. Datos mínimos del cliente.
    await page.getByPlaceholder("Carla Mendoza").fill("Test Cliente E2E");
    await page.getByPlaceholder("72345678").fill("72345678");

    // 4. Pago contra entrega — sin subir comprobante.
    await page.getByRole("button", { name: /Contra entrega/i }).click();

    // 5. Confirmar.
    await page.getByRole("button", { name: /Confirmar y avisar/i }).click();

    // Un checkout EXITOSO borra el carrito y deja la página de checkout —
    // sea a la página de tracking (router.push) o al storefront (el
    // redirect por carrito vacío del checkout server component). Un error
    // de validación/servidor mantendría al usuario en /checkout con un
    // alert; por eso "salir de /checkout" es prueba robusta de éxito.
    await expect(page).not.toHaveURL(/\/checkout/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/big-bite-wings/);
  });
});
