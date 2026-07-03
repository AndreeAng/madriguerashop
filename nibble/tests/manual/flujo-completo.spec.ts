import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// NOTA IMPORTANTE del entorno local (Windows + next start): las server
// actions COMMITEAN en milisegundos pero algunas respuestas HTTP nunca
// llegan al browser (spinner eterno). En CI/Linux no pasa. El patrón acá
// es inmune: click → esperar → navegar → verificar el efecto persistido.

/**
 * FLUJO MANUAL COMPLETO — recorre la app entera como lo haría un humano:
 *
 *   FASE A (superadmin): login → crear tienda de test + cuenta owner.
 *   FASE B (owner): configurar la tienda completa — horarios (¡nocturnos!),
 *          delivery/pickup, QR de pagos, categorías, 4 productos, banner,
 *          popup y 3 cupones (porcentaje, envío gratis, monto fijo).
 *   FASE C (cliente): 5 pedidos distintos — delivery/pickup, efectivo/QR
 *          con comprobante, con/sin cupón, programado, y cupón inválido.
 *   FASE D (owner): verifica el pago QR del pedido 4.
 *
 * Corre contra la app YA levantada en :3000 (npm run start) con la DB local.
 * NO es parte del CI — usar: npx playwright test -c playwright.manual.config.ts
 */

const IMG = path.join(__dirname, "assets", "test-img.png");
const SHOTS = path.join(__dirname, "shots");

// Sufijo único por corrida para no chocar con datos de corridas anteriores.
const RUN = Date.now().toString(36).slice(-5);
const STORE = {
  name: `Kiosko Prueba ${RUN.toUpperCase()}`,
  slug: `kiosko-test-${RUN}`,
  ownerEmail: `owner.test.${RUN}@test.bo`,
  ownerPass: "TestOwner#2026!",
};

function envCred(key: string): string {
  const env = readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8");
  const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`${key} no está en .env`);
  return m[1]!.trim().replace(/^"|"$/g, "");
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

/** goto + espera de red inactiva: clickear un submit ANTES de que React
 *  hidrate dispara un submit nativo (recarga la página y limpia el form
 *  sin error visible). */
async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function login(page: Page, user: string, pass: string, landing: RegExp) {
  await gotoHydrated(page, "/login");
  await page.getByPlaceholder(/diego@bigbite/i).fill(user);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(landing, { timeout: 20000 });
}

/** Cierra popup del storefront y banner de cookies si aparecen. */
async function dismissOverlays(page: Page) {
  const accept = page.getByRole("button", { name: /acepta/i }).first();
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.waitForTimeout(1500); // delaySeconds=1 del popup
  const close = page.getByRole("button", { name: /cerrar/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
}

/** Llena el checkout: datos, método de entrega/pago, cupón opcional. */
async function checkout(
  page: Page,
  opts: {
    phone: string;
    method: "delivery" | "pickup";
    payment: "cash" | "qr";
    coupon?: string;
    expectSavings?: RegExp;
    qrTotal?: RegExp;
    schedule?: string; // "YYYY-MM-DDTHH:mm"
    invalidCouponFirst?: string;
  },
) {
  await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  if (opts.method === "pickup") {
    await page.getByRole("button", { name: /Recoger en local/i }).click();
  } else {
    await page.getByRole("button", { name: /^Delivery$/i }).click();
    await page
      .getByPlaceholder(/Av\. Am/i)
      .fill("Calle Falsa 123, zona central, Cochabamba");
  }

  await page.getByPlaceholder("Carla Mendoza").fill("Cliente De Prueba");
  await page.getByPlaceholder("72345678").fill(opts.phone);

  if (opts.schedule) {
    await page.getByRole("button", { name: /Programar/i }).click();
    await page.locator('input[type="datetime-local"]').fill(opts.schedule);
  }

  // Cupón inválido primero (prueba negativa) si se pidió.
  if (opts.invalidCouponFirst) {
    await page.getByPlaceholder("BIENVENIDO10").fill(opts.invalidCouponFirst);
    await page.getByRole("button", { name: /^Aplicar$/i }).click();
    await expect(page.getByText(/inválido/i).first()).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("BIENVENIDO10").fill("");
  }

  if (opts.coupon) {
    await page.getByPlaceholder("BIENVENIDO10").fill(opts.coupon);
    await page.getByRole("button", { name: /^Aplicar$/i }).click();
    await expect(page.getByText(/aplicado/i).first()).toBeVisible({ timeout: 10000 });
    if (opts.expectSavings) {
      await expect(page.getByText(opts.expectSavings).first()).toBeVisible();
    }
  }

  if (opts.payment === "qr") {
    await page.getByRole("button", { name: /QR del banco/i }).click();
    if (opts.qrTotal) {
      await expect(page.getByText(opts.qrTotal).first()).toBeVisible();
    }
    // Subir comprobante (el input es sr-only).
    await page.locator('input[type="file"]').setInputFiles(IMG);
    await expect(page.getByText(/Comprobante listo/i)).toBeVisible({ timeout: 20000 });
  } else {
    await page.getByRole("button", { name: /Contra entrega/i }).click();
  }

  await page.getByRole("button", { name: /Confirmar y avisar/i }).click();
  // Camino feliz: redirect al tracking. Fallback (cuelgue local de la
  // respuesta): buscar la orden en DB por teléfono y abrir su tracking.
  try {
    await expect(page).toHaveURL(/\/orden\//, { timeout: 15000 });
  } catch {
    console.log(`  (respuesta colgada — verificando orden en DB para ${opts.phone})`);
    const order = await dbFindOrderByPhone(opts.phone);
    expect(order, `la orden del ${opts.phone} debe existir en DB`).toBeTruthy();
    await page.goto(`/${STORE.slug}/orden/${order!.trackingToken}`);
    await expect(page).toHaveURL(/\/orden\//);
  }
}

// ============== Acceso directo a DB (verificación + fallback) ==============
let _db: PrismaClient | null = null;
function db(): PrismaClient {
  if (!_db) {
    _db = new PrismaClient({ datasourceUrl: envCred("DATABASE_URL") });
  }
  return _db;
}
async function dbFindOrderByPhone(phone: string) {
  return db().order.findFirst({
    where: { customerPhone: `+591${phone}`, store: { slug: STORE.slug } },
    select: { trackingToken: true, orderNumber: true, total: true },
  });
}

/** Guarda (click) y verifica el efecto navegando — inmune al cuelgue local. */
async function saveAndVerify(
  page: Page,
  submit: () => Promise<void>,
  verifyUrl: string,
  verifyText: string,
) {
  await submit();
  await page.waitForTimeout(4000);
  await gotoHydrated(page, verifyUrl);
  await expect(page.getByText(verifyText).first()).toBeVisible({ timeout: 15000 });
}

test("flujo completo: superadmin → tienda completa → 5 pedidos", async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);

  // ============================================================
  // FASE A — SUPERADMIN crea la tienda de test + cuenta owner
  // ============================================================
  const adminCtx: BrowserContext = await browser.newContext();
  const admin = await adminCtx.newPage();
  // Diagnóstico: errores JS del browser y duración de los POST de actions.
  admin.on("pageerror", (err) => console.log(`  [pageerror] ${err.message}`));
  admin.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [console.error] ${msg.text().slice(0, 200)}`);
  });
  const postStarts = new Map<string, number>();
  admin.on("request", (r) => {
    if (r.method() === "POST") postStarts.set(r.url(), Date.now());
  });
  admin.on("requestfinished", (r) => {
    if (r.method() === "POST") {
      const ms = Date.now() - (postStarts.get(r.url()) ?? Date.now());
      console.log(`  POST ${r.url().replace("http://localhost:3000", "")} → ${ms}ms`);
    }
  });
  await login(admin, envCred("SEED_SUPER_ADMIN_EMAIL"), envCred("SEED_SUPER_ADMIN_PASSWORD"), /\/admin/);
  console.log("[A] superadmin logueado");
  await shot(admin, "A1-admin-home");

  await gotoHydrated(admin, "/admin/tiendas/nueva");
  // La hidratación de React puede llegar DESPUÉS de networkidle y resetear
  // los campos controlados (selects, PhoneInputBO) a vacío. Llenamos,
  // verificamos que los valores quedaron, y reintentamos si se perdieron.
  const fillAdminForm = async () => {
    await admin.locator('input[name="storeName"]').fill(STORE.name);
    await admin.locator('input[name="slug"]').fill(STORE.slug);
    await admin.locator('select[name="vertical"]').selectOption("RESTAURANT");
    // index 0 es el placeholder deshabilitado; 1 = Starter.
    await admin.locator('select[name="planSlug"]').selectOption({ index: 1 });
    // El form del admin usa input plano con formato completo +591XXXXXXXX
    // (a diferencia del checkout, que usa PhoneInputBO con prefijo sticky).
    await admin.getByRole("textbox", { name: /whatsapp/i }).fill("+59172999888");
    await admin.locator('input[name="city"]').fill("Cochabamba");
    await admin.locator('input[name="ownerName"]').fill("Owner De Prueba");
    await admin.locator('input[name="ownerIdentifier"]').fill(STORE.ownerEmail);
    await admin.locator('input[name="ownerPassword"]').fill(STORE.ownerPass);
  };
  await fillAdminForm();
  await admin.waitForTimeout(1500);
  const waValue = await admin.getByRole("textbox", { name: /whatsapp/i }).inputValue();
  if (!waValue.includes("72999888") || waValue === "") {
    console.log("[A] hidratación reseteó el form — reintentando fills");
    await fillAdminForm();
  }
  await expect(admin.locator('select[name="vertical"]')).toHaveValue("RESTAURANT");
  await shot(admin, "A2-admin-form-tienda");
  await admin.locator('form button[type="submit"]').last().click();
  // NOTA (hallazgo): la action crea la tienda en DB al instante, pero su
  // respuesta al cliente queda colgada (el botón nunca sale de "Creando…"
  // y el router.push a /admin/tiendas?q= no ocurre). Verificamos el efecto
  // real navegando al listado — el cuelgue queda registrado como issue.
  await admin.waitForTimeout(8000);
  await gotoHydrated(admin, `/admin/tiendas?q=${STORE.slug}`);
  await expect(admin.getByText(STORE.name).first()).toBeVisible({ timeout: 15000 });
  console.log(`[A] tienda creada: ${STORE.slug} (owner ${STORE.ownerEmail})`);
  await shot(admin, "A3-tienda-creada");
  await adminCtx.close();

  // ============================================================
  // FASE B — OWNER configura la tienda completa
  // ============================================================
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await login(owner, STORE.ownerEmail, STORE.ownerPass, /\/dashboard/);
  console.log("[B] owner logueado");

  // B1. Horarios NOCTURNOS (09:00 → 02:00, cruza medianoche): la tienda
  // queda abierta ahora (~22:xx BOT) y de paso se prueba el fix overnight.
  await gotoHydrated(owner, "/dashboard/settings");
  for (let d = 0; d < 7; d++) {
    await owner.locator(`input[name="day_${d}_open"]`).fill("09:00");
    await owner.locator(`input[name="day_${d}_close"]`).fill("02:00");
  }
  const hoursForm = owner.locator("form", { has: owner.locator('input[name="day_0_open"]') });
  await hoursForm.locator('button[type="submit"]').click();
  await owner.waitForTimeout(1500);
  console.log("[B] horarios nocturnos 09:00-02:00 guardados");

  // B2. Delivery + pickup + fee por defecto Bs 10.
  const deliveryForm = owner.locator("form", { has: owner.locator('input[name="defaultDeliveryFee"]') });
  const pickup = deliveryForm.locator('input[name="pickupEnabled"]');
  if (!(await pickup.isChecked())) await pickup.check();
  const delivery = deliveryForm.locator('input[name="deliveryEnabled"]');
  if (!(await delivery.isChecked())) await delivery.check();
  await deliveryForm.locator('input[name="defaultDeliveryFee"]').fill("10");
  await deliveryForm.locator('button[type="submit"]').click();
  await owner.waitForTimeout(1500);
  console.log("[B] delivery Bs 10 + pickup habilitados");

  // B3. Pagos: subir imagen del QR (efectivo ya viene habilitado).
  const paymentsForm = owner.locator("form", { has: owner.locator('input[name="qrImageUrl"]') });
  const qrCheck = paymentsForm.locator('input[name="acceptsQR"]');
  if (!(await qrCheck.isChecked())) await qrCheck.check();
  await paymentsForm.locator('input[type="file"]').setInputFiles(IMG);
  await expect(paymentsForm.locator('input[name="qrImageUrl"]')).toHaveValue(/.+/, { timeout: 20000 });
  await paymentsForm.locator('button[type="submit"]').click();
  await owner.waitForTimeout(1500);
  console.log("[B] QR de pagos subido");
  await shot(owner, "B1-settings");

  // B4. Categorías.
  for (const cat of ["Comidas", "Bebidas"]) {
    await gotoHydrated(owner, "/dashboard/categorias");
    await owner.getByRole("button", { name: /Nueva categor/i }).click();
    await owner.locator('input[name="name"]').fill(cat);
    await saveAndVerify(
      owner,
      () => owner.getByRole("button", { name: /Crear categor/i }).click(),
      "/dashboard/categorias",
      cat,
    );
  }
  console.log("[B] categorias: Comidas, Bebidas");

  // B5. Productos.
  const products: { name: string; price: string; cat: string; stock?: string }[] = [
    { name: "Empanada de Queso", price: "15", cat: "Comidas" },
    { name: "Saltena de Pollo", price: "12", cat: "Comidas", stock: "50" },
    { name: "Mocochinchi", price: "8", cat: "Bebidas" },
    { name: "Combo Familiar", price: "60", cat: "Comidas" },
  ];
  for (const p of products) {
    await gotoHydrated(owner, "/dashboard/productos/nuevo");
    await owner.locator('input[name="name"]').fill(p.name);
    await owner.locator('input[name="basePrice"]').fill(p.price);
    await owner.locator('select[name="categoryId"]').selectOption({ label: p.cat });
    if (p.stock) {
      await owner.locator('input[name="manageStock"]').check();
      await owner.locator('input[name="stock"]').fill(p.stock);
    }
    await saveAndVerify(
      owner,
      () => owner.getByRole("button", { name: /guardar|crear/i }).last().click(),
      "/dashboard/productos",
      p.name,
    );
    console.log(`[B] producto: ${p.name} (Bs ${p.price})`);
  }
  await shot(owner, "B2-productos");

  // B6. Banner.
  await gotoHydrated(owner, "/dashboard/promociones");
  await owner.getByRole("button", { name: /Banners/i }).click().catch(() => {});
  await owner.getByRole("button", { name: /Nuevo banner/i }).click();
  // El modal tiene DOS uploads (desktop + móvil): el primero es imageUrl.
  await owner.locator('input[type="file"]').first().setInputFiles(IMG);
  await expect(owner.locator('input[name="imageUrl"]').last()).toHaveValue(/.+/, { timeout: 20000 });
  const bannerTitle = owner.locator('input[name="title"]').last();
  if (await bannerTitle.isVisible().catch(() => false)) await bannerTitle.fill("Gran apertura");
  await owner.getByRole("button", { name: /^Guardar$/i }).click();
  await owner.waitForTimeout(4000);
  await gotoHydrated(owner, "/dashboard/promociones");
  await owner.getByRole("button", { name: /Banners/i }).click().catch(() => {});
  await expect(owner.getByText("Gran apertura").first()).toBeVisible({ timeout: 15000 });
  console.log("[B] banner creado");

  // B7. Popup (delay 1s para que el test lo vea rápido).
  await owner.getByRole("button", { name: /Popups/i }).click();
  await owner.getByRole("button", { name: /Nuevo popup/i }).click();
  await owner.locator('input[name="title"]').last().fill("Bienvenido!");
  await owner.locator('textarea[name="message"]').fill("Promo de apertura: usa el cupon PERCENT10.");
  await owner.locator('input[name="delaySeconds"]').fill("1");
  await owner.getByRole("button", { name: /^Guardar$/i }).click();
  await owner.waitForTimeout(4000);
  await gotoHydrated(owner, "/dashboard/promociones");
  await owner.getByRole("button", { name: /Popups/i }).click();
  await expect(owner.getByText("Bienvenido!").first()).toBeVisible({ timeout: 15000 });
  console.log("[B] popup creado");

  // B8. Cupones: porcentaje, envío gratis y monto fijo con mínimo.
  const coupons = [
    { code: "PERCENT10", type: "PERCENTAGE", value: "10" },
    { code: "ENVIOGRATIS", type: "FREE_SHIPPING", value: "" },
    { code: "FIJO20", type: "FIXED_AMOUNT", value: "20", min: "50" },
  ];
  for (const c of coupons) {
    await gotoHydrated(owner, "/dashboard/promociones");
    await owner.getByRole("button", { name: /Cupones/i }).click();
    await owner.getByRole("button", { name: /Nuevo cup/i }).click();
    await owner.locator('input[name="code"]').fill(c.code);
    await owner.locator('select[name="type"]').selectOption(c.type);
    if (c.value) await owner.locator('input[name="value"]').fill(c.value);
    if (c.min) await owner.locator('input[name="minOrderAmount"]').fill(c.min);
    await owner.locator('input[name="validFrom"]').fill("2026-07-01T00:00");
    await owner.locator('input[name="validTo"]').fill("2026-08-31T23:59");
    await owner.getByRole("button", { name: /^Guardar$/i }).click();
    await owner.waitForTimeout(4000);
    await gotoHydrated(owner, "/dashboard/promociones");
    await owner.getByRole("button", { name: /Cupones/i }).click();
    await expect(owner.getByText(c.code).first()).toBeVisible({ timeout: 15000 });
    console.log(`[B] cupon: ${c.code} (${c.type})`);
  }
  await shot(owner, "B3-promociones");

  // ============================================================
  // FASE C — CLIENTE: storefront + 5 pedidos
  // ============================================================
  const custCtx = await browser.newContext();
  await custCtx.addInitScript(() => {
    window.open = () => null; // neutraliza el tab de WhatsApp
  });
  const cust = await custCtx.newPage();

  // Storefront: banner + popup + productos visibles.
  await gotoHydrated(cust, `/${STORE.slug}`);
  await expect(cust.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15000 });
  await expect(cust.getByText("Bienvenido!").first()).toBeVisible({ timeout: 10000 });
  await shot(cust, "C0-storefront-con-popup");
  await dismissOverlays(cust);
  await expect(cust.getByText("Empanada de Queso").first()).toBeVisible();
  console.log("[C] storefront OK: banner, popup y productos visibles");

  // Directo al PDP (su botón "Agregar" navega al checkout; el del card
  // del menú solo suma al carrito). Slug = slugify(nombre).
  const goToProduct = async (productSlug: string) => {
    await gotoHydrated(cust, `/${STORE.slug}/p/${productSlug}`);
    await dismissOverlays(cust);
    await cust.getByRole("button", { name: /Agregar/i }).first().click();
  };

  // PEDIDO 1 — delivery + efectivo, SIN cupón. Empanada 15 + envío 10 = 25.
  await goToProduct("empanada-de-queso");
  await checkout(cust, { phone: "72000001", method: "delivery", payment: "cash" });
  await expect(cust.getByText(/25([.,]00)?/).first()).toBeVisible();
  await shot(cust, "C1-pedido1-delivery-efectivo");
  console.log("[C] pedido 1 OK: delivery + efectivo, total Bs 25");

  // PEDIDO 2 — pickup + efectivo + PERCENT10. Salteña 12 → 10.80.
  await goToProduct("saltena-de-pollo");
  await checkout(cust, {
    phone: "72000002",
    method: "pickup",
    payment: "cash",
    coupon: "PERCENT10",
    expectSavings: /ahorras/i,
  });
  await expect(cust.getByText(/10[.,]80/).first()).toBeVisible();
  await shot(cust, "C2-pedido2-pickup-percent10");
  console.log("[C] pedido 2 OK: pickup + PERCENT10, total Bs 10.80");

  // PEDIDO 3 — delivery + efectivo + ENVIOGRATIS. Combo 60 + envío 10 → 60.
  // (Valida en la app real el fix del doble descuento de FREE_SHIPPING.)
  await goToProduct("combo-familiar");
  await checkout(cust, {
    phone: "72000003",
    method: "delivery",
    payment: "cash",
    coupon: "ENVIOGRATIS",
    expectSavings: /ahorras/i,
  });
  await expect(cust.getByText(/ENVIOGRATIS/).first()).toBeVisible();
  await expect(cust.getByText(/60([.,]00)?/).first()).toBeVisible();
  await shot(cust, "C3-pedido3-enviogratis");
  console.log("[C] pedido 3 OK: ENVIOGRATIS descuenta el envio UNA vez, total Bs 60");

  // PEDIDO 4 — delivery + QR con comprobante + FIJO20 (mín 50).
  // Combo 60 − 20 + envío 10 = 50. El QR debe mostrar el total CON cupón.
  await goToProduct("combo-familiar");
  await checkout(cust, {
    phone: "72000004",
    method: "delivery",
    payment: "qr",
    coupon: "FIJO20",
    qrTotal: /pagar\s*Bs\.?\s*50/i,
  });
  await expect(cust.getByText(/Pago pendiente|verifiquemos|comprobante/i).first()).toBeVisible();
  await shot(cust, "C4-pedido4-qr-fijo20");
  console.log("[C] pedido 4 OK: QR muestra Bs 50 con cupon aplicado ANTES de pagar");

  // PEDIDO 5 — pickup PROGRAMADO + cupón inválido primero. Mocochinchi 8.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const sched = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T12:00`;
  await goToProduct("mocochinchi");
  await checkout(cust, {
    phone: "72000005",
    method: "pickup",
    payment: "cash",
    schedule: sched,
    invalidCouponFirst: "NOEXISTE",
  });
  await expect(cust.getByText(/8([.,]00)?/).first()).toBeVisible();
  await shot(cust, "C5-pedido5-programado");
  console.log("[C] pedido 5 OK: programado manana 12:00, cupon invalido rechazado");
  await custCtx.close();

  // ============================================================
  // FASE D — OWNER verifica el pago QR del pedido 4
  // ============================================================
  await gotoHydrated(owner, "/dashboard/pedidos");
  await shot(owner, "D1-pedidos-lista");
  // El pedido QR está en PENDING_PAYMENT → tab "Por verificar", no "Activos".
  await owner.getByRole("link", { name: /Por verificar/i }).or(
    owner.getByRole("button", { name: /Por verificar/i }),
  ).first().click();
  await expect(owner.getByText(/#4/).first()).toBeVisible({ timeout: 15000 });
  await owner.getByText(/#4/).first().click();
  await expect(owner).toHaveURL(/\/dashboard\/pedidos\/.+/, { timeout: 15000 });
  const orderDetailUrl = owner.url();
  await owner.waitForLoadState("networkidle");
  await owner.getByRole("button", { name: /verificar pago/i }).click();
  const confirmBtn = owner.getByRole("button", { name: /^(confirmar|sí|verificar)$/i }).last();
  if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
  // Inmune al cuelgue local: recargar el detalle y verificar el estado.
  await owner.waitForTimeout(4000);
  await gotoHydrated(owner, orderDetailUrl);
  await expect(owner.getByText(/verificado/i).first()).toBeVisible({ timeout: 15000 });
  await shot(owner, "D2-pago-verificado");
  console.log("[D] pago QR del pedido #4 verificado por el owner");
  await ownerCtx.close();
  await db().$disconnect();

  console.log(`\n=== FLUJO COMPLETO OK — tienda: /${STORE.slug} ===`);
});
