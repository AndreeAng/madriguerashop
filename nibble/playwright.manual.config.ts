import { defineConfig, devices } from "@playwright/test";

/**
 * Config para el FLUJO MANUAL COMPLETO (tests/manual/) — separado del
 * testDir de CI (tests/e2e) a propósito: este flujo crea datos reales
 * (tienda, cupones, 5 pedidos) y dura varios minutos; no debe correr en
 * el pipeline. Asume la app ya corriendo en :3000 (`npm run start`).
 */
export default defineConfig({
  testDir: "./tests/manual",
  timeout: 20 * 60 * 1000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 12_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
