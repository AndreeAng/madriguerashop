import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para tests E2E.
 *
 * Asume que la app está corriendo en localhost:3000 (manualmente con
 * `npm run dev`) o que `webServer` la levanta automáticamente.
 *
 * Pre-requisito: `npm run db:seed` debe estar corrido para tener las 5
 * tiendas demo. Los tests usan `big-bite-wings`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],

  // Auto-startup del servidor: en CI levantamos `next build && next start`
  // (más cercano a prod). En local, `next dev` con reuse si ya hay app
  // corriendo en el puerto. Sin esto, los E2E en CI fallaban con "connection
  // refused" porque nadie levantaba la app.
  webServer: {
    command: process.env.CI
      ? "npm run build && npm run start"
      : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
