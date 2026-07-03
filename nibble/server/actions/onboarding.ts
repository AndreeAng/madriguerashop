"use server";

import { z } from "zod";
import { Prisma, Role, StoreStatus, BillingCycle, StoreVertical } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  normalizeIdentifier,
  normalizePhoneBO,
  PHONE_BO_RE,
} from "@/lib/auth/identifiers";
import { slugify, validateSlug } from "@/lib/validation/slug";
import { zodIssuesToFieldErrors } from "@/lib/validation/fieldErrors";
import { signIn } from "@/auth";
import { sendEmailBackground } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { emailVerificationEmail } from "@/lib/email/templates/email-verification";
import { generateEmailVerificationToken } from "@/lib/auth/email-verification-token";
import { appUrl } from "@/lib/email/client";
import { audit } from "@/lib/audit/log";
import { rateLimit, getClientIp, rateLimitErrorMessage } from "@/lib/security/rateLimit";
import { MAX_PASSWORD_LENGTH } from "@/lib/constants";
import { captureError } from "@/lib/observability/captureError";

// ============== Constantes de producto ==============
//
// Estas son decisiones que afectan TODO el ciclo de vida del cliente.
// Centralizadas aquí para que sean fáciles de cambiar.

/** Plan por defecto al registrarse. Coincide con el seed: "starter". */
const DEFAULT_PLAN_SLUG = "starter";

/** Ciclo de facturación inicial. */
const DEFAULT_BILLING_CYCLE: BillingCycle = BillingCycle.MONTHLY;

// ============== Schema ==============

const registerSchema = z.object({
  // Tienda
  storeName: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  slug: z.string().trim().min(1, "Elige un identificador para tu tienda"),
  vertical: z.nativeEnum(StoreVertical, {
    message: "Elige el rubro de tu tienda",
  }),
  whatsappPhone: z
    .string()
    .trim()
    .refine(
      (v) => PHONE_BO_RE.test(v.replace(/[\s-]/g, "")),
      "Teléfono inválido. Formato: +591XXXXXXXX",
    ),
  city: z.string().trim().min(2, "Ingresa tu ciudad").max(60),

  // Owner
  ownerName: z.string().trim().min(2, "Ingresa tu nombre completo").max(80),
  ownerIdentifier: z.string().trim().min(1, "Email o teléfono del responsable"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(MAX_PASSWORD_LENGTH),
  // Aceptación de términos: el checkbox del form envía "on" cuando está
  // marcado. Sin este check el registro queda expuesto legalmente —
  // /terminos y /privacidad ya existen pero nada en server-side fuerza la
  // aceptación. Browsers requieren `required` en el input, pero curl/bots
  // pueden saltearlo; por eso validamos también acá.
  acceptTerms: z.literal("on", {
    message: "Tienes que aceptar los términos y la política de privacidad.",
  }),
});

export type RegisterStoreState = {
  ok?: true;
  /** El registro fue exitoso pero el auto-login posterior falló. La UI
      muestra mensaje y redirige a /login con el username pre-llenado. */
  autoLoginFailed?: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "storeName"
      | "slug"
      | "vertical"
      | "whatsappPhone"
      | "city"
      | "ownerName"
      | "ownerIdentifier"
      | "password"
      | "acceptTerms",
      string
    >
  >;
};

// ============== Action ==============

export async function registerStoreAction(
  _prev: RegisterStoreState,
  formData: FormData,
): Promise<RegisterStoreState> {
  // 0. Honeypot — si el campo invisible está completo, es un bot.
  // Devolvemos OK silencioso para no darle señal al bot.
  const honeypot = formData.get("company_role");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    // Hacemos timeout artificial para no diferenciar respuesta de un registro real
    await new Promise((r) => setTimeout(r, 800));
    return { error: "No pudimos completar el registro. Prueba de nuevo." };
  }

  // 1. Rate limit por IP — 5 registros / hora es generoso pero detiene spam
  const ip = await getClientIp();
  const rl = await rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.success) {
    return { error: rateLimitErrorMessage(rl.retryAfter) };
  }

  // 2. Parse + validate form
  const parsed = registerSchema.safeParse({
    storeName: formData.get("storeName"),
    slug: formData.get("slug"),
    vertical: formData.get("vertical"),
    whatsappPhone: formData.get("whatsappPhone"),
    city: formData.get("city"),
    ownerName: formData.get("ownerName"),
    ownerIdentifier: formData.get("ownerIdentifier"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: zodIssuesToFieldErrors<
        keyof NonNullable<RegisterStoreState["fieldErrors"]>
      >(parsed.error),
    };
  }

  const data = parsed.data;

  // 2. Validate slug (formato + reservado)
  const slugCheck = validateSlug(slugify(data.slug));
  if (!slugCheck.ok) {
    return {
      fieldErrors: {
        slug:
          slugCheck.reason === "reserved"
            ? "Este identificador está reservado. Prueba con otro."
            : "Identificador inválido. Sólo letras, números y guiones.",
      },
    };
  }
  const slug = slugCheck.value;

  // 3. Normalize identifier (email o teléfono)
  const ident = normalizeIdentifier(data.ownerIdentifier);
  if (ident.kind === "unknown") {
    return { fieldErrors: { ownerIdentifier: "Email o teléfono inválido" } };
  }
  const username = ident.value;
  const email = ident.kind === "email" ? ident.value : null;
  const phone = ident.kind === "phone" ? ident.value : null;

  // 4. Normalize WhatsApp phone
  const whatsappPhone = normalizePhoneBO(data.whatsappPhone);

  // 5. Lookup template + plan + check uniqueness — fuera de la transacción
  //    porque son lecturas y queremos errores legibles antes del lock.
  //
  //    Para el template: intentamos primero match exacto por vertical. Si no
  //    hay (verticales nuevas como BAKERY, BEAUTY, OTHER pueden no tener
  //    template propio en el seed), caemos a RETAIL como genérico, y como
  //    último recurso cualquier template activo. El owner puede personalizar
  //    después en su dashboard — mejor que rechazar el registro entero.
  const [existingSlug, existingUser, exactTemplate, plan] = await Promise.all([
    db.store.findUnique({ where: { slug }, select: { id: true } }),
    db.user.findUnique({ where: { username }, select: { id: true } }),
    db.template.findFirst({
      where: { vertical: data.vertical, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    }),
    db.plan.findUnique({
      where: { slug: DEFAULT_PLAN_SLUG },
      select: { id: true },
    }),
  ]);

  let template = exactTemplate;
  if (!template) {
    template =
      (await db.template.findFirst({
        where: { vertical: "RETAIL", isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      })) ??
      (await db.template.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      }));
  }

  if (existingSlug) {
    return { fieldErrors: { slug: "Este identificador ya está en uso." } };
  }
  if (existingUser) {
    return {
      fieldErrors: {
        ownerIdentifier:
          "Ya existe una cuenta con este email/teléfono. Inicia sesión en su lugar.",
      },
    };
  }
  if (!template) {
    return {
      error:
        "No encontramos un template para ese rubro. Contacta a soporte (este es un error nuestro).",
    };
  }
  if (!plan) {
    return {
      error:
        "No hay un plan disponible. Ejecuta `npm run db:seed` o contacta a soporte.",
    };
  }

  // 6. Crear todo en una transacción atómica.
  // No hay período de prueba: la tienda nace ACTIVE y la primera factura se
  // emite inmediatamente (ver paso 7).
  const passwordHash = await hashPassword(data.password);
  let createdStoreId: string | null = null;
  let createdUserId: string | null = null;

  try {
    await db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          slug,
          name: data.storeName,
          vertical: data.vertical,
          status: StoreStatus.ACTIVE,
          templateId: template.id,
          planId: plan.id,
          billingCycle: DEFAULT_BILLING_CYCLE,
          whatsappPhone,
          city: data.city,
        },
      });
      createdStoreId = store.id;

      const user = await tx.user.create({
        data: {
          username,
          email,
          phone,
          passwordHash,
          role: Role.STORE_OWNER,
          fullName: data.ownerName,
          storeId: store.id,
          isActive: true,
        },
      });
      createdUserId = user.id;

      // Horarios por defecto: Lun–Dom, 09:00–21:00. El owner los edita en /dashboard/settings.
      await tx.storeHours.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          storeId: store.id,
          dayOfWeek,
          openTime: "09:00",
          closeTime: "21:00",
          isClosed: false,
        })),
      });
    });
  } catch (err) {
    // Carrera entre el check de unicidad y el create — Prisma P2002 = unique violation
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.includes("slug")) {
        return { fieldErrors: { slug: "Este identificador ya está en uso." } };
      }
      if (target.includes("username") || target.includes("email") || target.includes("phone")) {
        return {
          fieldErrors: {
            ownerIdentifier: "Ya existe una cuenta con este email/teléfono.",
          },
        };
      }
    }
    throw err;
  }

  // 7. Generar la primera factura inmediatamente.
  // Sin período de prueba, el modelo es "pagas antes de operar" — pero damos
  // BILLING_DUE_DAYS de plazo para pagar antes de marcar como vencida.
  if (createdStoreId) {
    try {
      const { generateInvoice } = await import("@/lib/billing/generateInvoice");
      await generateInvoice(createdStoreId);
    } catch (err) {
      // No bloqueamos el registro si la primera factura falla — el cron
      // diario la generará en su próxima corrida.
      captureError(err, { action: "onboarding.firstInvoice", storeId: createdStoreId });
    }
  }

  // 8. Audit log + email de bienvenida (fire-and-forget — no debe bloquear el registro)
  await audit({
    action: "store.registered",
    target: slug,
    metadata: { storeName: data.storeName, vertical: data.vertical, identifier: ident.kind },
  });
  if (email) {
    sendEmailBackground(
      welcomeEmail({
        to: email,
        ownerName: data.ownerName,
        storeName: data.storeName,
        storeSlug: slug,
      }),
    );
    // Email de verificación con token stateless firmado (24h). Si el
    // usuario nunca lo clickea, no pasa nada — `emailVerifiedAt` queda
    // null y la app sigue funcionando. La verificación habilita
    // notificaciones (futuro) y previene typos en el email del registro.
    if (createdUserId) {
      const token = generateEmailVerificationToken(createdUserId, email);
      sendEmailBackground(
        emailVerificationEmail({
          to: email,
          verifyUrl: `${appUrl()}/verify-email/${token}`,
          storeName: data.storeName,
        }),
      );
    }
  }

  // 9. Auto-login. signIn() lanza un `NEXT_REDIRECT` cuando todo va bien —
  // eso NO es error y debe propagarse. Cualquier OTRA excepción (AuthError,
  // network, etc.) significa que el registro fue exitoso pero el auto-login
  // falló — en ese caso redirigimos a /login con el username pre-llenado.
  try {
    await signIn("credentials", {
      username,
      password: data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    // En Next 15 el redirect se identifica por `error.digest` que empieza
    // con "NEXT_REDIRECT;<type>;<url>". Antes se chequeaba `err.message`
    // pero ese campo dejó de ser estable. `isRedirectError` de next/navigation
    // es API interna, así que inspeccionamos el digest directamente.
    if (isNextRedirectError(err)) throw err;
    captureError(err, { action: "onboarding.autoLogin", storeId: createdStoreId });
    return {
      ok: true,
      autoLoginFailed: true,
    };
  }

  return { ok: true };
}

function isNextRedirectError(err: unknown): err is Error & { digest: string } {
  return (
    err instanceof Error &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
