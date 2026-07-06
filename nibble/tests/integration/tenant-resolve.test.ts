import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, type StoreStatus } from "@prisma/client";
import {
  getStoreBySlug,
  getStorefrontData,
  getStoreSlugById,
} from "@/lib/tenant/resolve";

/**
 * Resolución de tienda por slug — la frontera del multi-tenant público.
 *
 * El invariante crítico: `getStorefrontData` NO debe exponer tiendas
 * SUSPENDED/CANCELLED al storefront público (permite ACTIVE y PAST_DUE).
 * Un bug acá = una tienda suspendida por falta de pago sigue vendiendo, o
 * una cancelada queda indexable. `getStoreBySlug` (uso interno) en cambio
 * NO filtra por estado.
 */

const prisma = new PrismaClient();

const STAMP = Date.now();
const PREFIX = `test-tenant-${STAMP}`;
// Un slug por estado para que el cache per-request de React (si dedupe en el
// proceso de test) nunca devuelva una tienda de otro estado.
const slugFor = (s: string) => `${PREFIX}-${s.toLowerCase()}`;

let templateId: string;
let planId: string;
const createdIds: Record<string, string> = {};

async function makeStore(status: StoreStatus) {
  const store = await prisma.store.create({
    data: {
      slug: slugFor(status),
      name: `Store ${status}`,
      vertical: "RETAIL",
      templateId,
      planId,
      whatsappPhone: "+59170000000",
      status,
    },
  });
  createdIds[status] = store.id;
  return store;
}

beforeAll(async () => {
  const template = await prisma.template.findFirst();
  const plan = await prisma.plan.findFirst();
  if (!template || !plan) throw new Error("Test DB sin template/plan (correr seed).");
  templateId = template.id;
  planId = plan.id;

  await makeStore("ACTIVE");
  await makeStore("PAST_DUE");
  await makeStore("SUSPENDED");
  await makeStore("CANCELLED");
});

afterAll(async () => {
  await prisma.store.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("getStoreBySlug (uso interno — sin filtro de estado)", () => {
  it("resuelve una tienda ACTIVE", async () => {
    const s = await getStoreBySlug(slugFor("ACTIVE"));
    expect(s?.slug).toBe(slugFor("ACTIVE"));
  });

  it("resuelve también una tienda SUSPENDED (no filtra estado)", async () => {
    const s = await getStoreBySlug(slugFor("SUSPENDED"));
    expect(s?.status).toBe("SUSPENDED");
  });

  it("devuelve null para slug inexistente", async () => {
    expect(await getStoreBySlug(`${PREFIX}-nope`)).toBeNull();
  });

  it("devuelve null para slug vacío (sin tocar la DB)", async () => {
    expect(await getStoreBySlug("")).toBeNull();
  });
});

describe("getStorefrontData (público — bloquea SUSPENDED/CANCELLED)", () => {
  it("expone una tienda ACTIVE con sus relaciones", async () => {
    const s = await getStorefrontData(slugFor("ACTIVE"));
    expect(s).not.toBeNull();
    expect(s!.status).toBe("ACTIVE");
    // Incluye las relaciones que el storefront necesita.
    expect(s!.template).toBeTruthy();
    expect(Array.isArray(s!.storeHours)).toBe(true);
    expect(s!.plan).toBeTruthy();
  });

  it("expone una tienda PAST_DUE (moroso pero todavía visible)", async () => {
    const s = await getStorefrontData(slugFor("PAST_DUE"));
    expect(s?.status).toBe("PAST_DUE");
  });

  it("BLOQUEA una tienda SUSPENDED → null", async () => {
    expect(await getStorefrontData(slugFor("SUSPENDED"))).toBeNull();
  });

  it("BLOQUEA una tienda CANCELLED → null", async () => {
    expect(await getStorefrontData(slugFor("CANCELLED"))).toBeNull();
  });

  it("devuelve null para slug inexistente", async () => {
    expect(await getStorefrontData(`${PREFIX}-nope`)).toBeNull();
  });
});

describe("getStoreSlugById", () => {
  it("resuelve el slug a partir del id", async () => {
    const slug = await getStoreSlugById(createdIds["ACTIVE"]!);
    expect(slug).toBe(slugFor("ACTIVE"));
  });

  it("devuelve '' para id inexistente", async () => {
    expect(await getStoreSlugById("noexiste")).toBe("");
  });

  it("devuelve '' para id vacío (sin tocar la DB)", async () => {
    expect(await getStoreSlugById("")).toBe("");
  });
});
