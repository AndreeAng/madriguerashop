import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type AlertType, type AlertSeverity } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Detector de alertas operativas. Corre dentro del cron de billing y crea
 * filas en `Alert` idempotentes vía `dedupeKey` (UNIQUE en el schema).
 *
 * Reglas:
 *  - CRON_FAILED: cualquier CronRun con status=FAILED en últimas 48h.
 *  - PROOF_REUSED: misma `paidProofUrl` usada en más de 1 invoice/order.
 *  - LOGIN_ATTACK: >20 auth.login.failed desde la misma IP en 10 min.
 *  - STORE_TRAFFIC_DROP: PageView últimos 7d cae >50% vs 7d previos
 *    (excluye tiendas con <14 días de vida).
 */
export async function runAlertDetection(opts: { now?: Date } = {}): Promise<{
  created: number;
  byType: Record<AlertType, number>;
}> {
  const now = opts.now ?? new Date();
  const created: AlertCandidate[] = [];

  created.push(...(await detectCronFailures(now)));
  created.push(...(await detectProofReuse()));
  created.push(...(await detectLoginAttacks(now)));
  created.push(...(await detectTrafficDrops(now)));

  // Insertar todo de una vez ignorando duplicados (UNIQUE on dedupeKey).
  let inserted = 0;
  const byType: Record<AlertType, number> = {
    CRON_FAILED: 0,
    PROOF_REUSED: 0,
    LOGIN_ATTACK: 0,
    STORE_TRAFFIC_DROP: 0,
  };
  for (const c of created) {
    try {
      await db.alert.create({ data: c });
      inserted++;
      byType[c.type]++;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Duplicado por dedupeKey — ya existe, skip.
        continue;
      }
      throw err;
    }
  }

  return { created: inserted, byType };
}

type AlertCandidate = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  data?: Prisma.InputJsonValue;
  storeId?: string | null;
  dedupeKey: string;
};

// ============== CRON_FAILED ==============

async function detectCronFailures(now: Date): Promise<AlertCandidate[]> {
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const failures = await db.cronRun.findMany({
    where: { status: "FAILED", startedAt: { gte: cutoff } },
    select: { id: true, name: true, startedAt: true, error: true },
  });
  return failures.map((f) => ({
    type: "CRON_FAILED" as const,
    severity: "HIGH" as const,
    title: `Cron "${f.name}" falló`,
    description:
      `La ejecución del cron empezó a las ${f.startedAt.toISOString()} y terminó en error. ` +
      (f.error ?? "Sin mensaje de error."),
    data: { cronRunId: f.id, cronName: f.name, error: f.error ?? null },
    dedupeKey: `cron_failed:${f.id}`,
  }));
}

// ============== PROOF_REUSED ==============

async function detectProofReuse(): Promise<AlertCandidate[]> {
  // Comprobantes de invoices SaaS reusados entre tiendas distintas.
  // Filtramos string vacío además de NULL — formularios mal validados pueden
  // mandar "" y agruparlos genera una alerta falsa con count enorme.
  type Row = {
    proofUrl: string;
    storeIds: string[];
    invoiceIds: string[];
    count: bigint;
  };
  const invoiceRows = await db.$queryRaw<Row[]>`
    SELECT
      "paidProofUrl"         AS "proofUrl",
      array_agg(DISTINCT "storeId") AS "storeIds",
      array_agg("id")        AS "invoiceIds",
      COUNT(*)::bigint       AS "count"
    FROM "Invoice"
    WHERE "paidProofUrl" IS NOT NULL AND "paidProofUrl" <> ''
    GROUP BY "paidProofUrl"
    HAVING COUNT(*) > 1
  `;

  // Comprobantes de pedidos reusados entre tiendas distintas.
  const orderRows = await db.$queryRaw<Row[]>`
    SELECT
      "paymentProofUrl"      AS "proofUrl",
      array_agg(DISTINCT "storeId") AS "storeIds",
      array_agg("id")        AS "invoiceIds",
      COUNT(*)::bigint       AS "count"
    FROM "Order"
    WHERE "paymentProofUrl" IS NOT NULL AND "paymentProofUrl" <> ''
    GROUP BY "paymentProofUrl"
    HAVING COUNT(*) > 1
  `;

  const out: AlertCandidate[] = [];
  for (const r of invoiceRows) {
    out.push({
      type: "PROOF_REUSED" as const,
      severity: r.storeIds.length > 1 ? "CRITICAL" : "HIGH",
      title:
        r.storeIds.length > 1
          ? "Comprobante reusado entre tiendas distintas (factura SaaS)"
          : "Comprobante reusado en varias facturas (misma tienda)",
      description:
        `El mismo comprobante (${r.proofUrl}) aparece en ${Number(r.count)} ` +
        `factura${Number(r.count) === 1 ? "" : "s"} del SaaS, ` +
        `${r.storeIds.length} tienda${r.storeIds.length === 1 ? "" : "s"} diferente${r.storeIds.length === 1 ? "" : "s"}.`,
      data: { proofUrl: r.proofUrl, invoiceIds: r.invoiceIds, storeIds: r.storeIds },
      storeId: r.storeIds.length === 1 ? r.storeIds[0] : null,
      dedupeKey: `proof_reused:invoice:${hashUrl(r.proofUrl)}`,
    });
  }
  for (const r of orderRows) {
    out.push({
      type: "PROOF_REUSED" as const,
      severity: r.storeIds.length > 1 ? "HIGH" : "MEDIUM",
      title:
        r.storeIds.length > 1
          ? "Comprobante reusado entre tiendas distintas (pedidos)"
          : "Comprobante reusado en varios pedidos (misma tienda)",
      description:
        `El mismo comprobante (${r.proofUrl}) aparece en ${Number(r.count)} ` +
        `pedido${Number(r.count) === 1 ? "" : "s"}, ` +
        `${r.storeIds.length} tienda${r.storeIds.length === 1 ? "" : "s"}.`,
      data: { proofUrl: r.proofUrl, orderIds: r.invoiceIds, storeIds: r.storeIds },
      storeId: r.storeIds.length === 1 ? r.storeIds[0] : null,
      dedupeKey: `proof_reused:order:${hashUrl(r.proofUrl)}`,
    });
  }
  return out;
}

function hashUrl(s: string): string {
  // SHA-256 truncado a 16 hex (64 bits) — ~18.4 quintillón posibilidades.
  // El hash de 32-bit anterior colisionaba con ~9K URLs (birthday paradox).
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// ============== LOGIN_ATTACK ==============

async function detectLoginAttacks(now: Date): Promise<AlertCandidate[]> {
  // Ventana deslizante: para cada IP, contamos los últimos 10 min "ahora".
  // La versión vieja agrupaba por buckets fijos al reloj (`minute % 10`), lo
  // que dejaba evadir alarmas distribuyendo los intentos a caballo de buckets.
  // Ahora la condición es "20+ fails en los últimos 10 min", evaluada al
  // instante del cron — una ráfaga real cae siempre dentro de la ventana.
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000);
  type Row = { ip: string; count: bigint; lastFail: Date };
  const rows = await db.$queryRaw<Row[]>`
    SELECT
      "ip",
      COUNT(*)::bigint AS "count",
      MAX("createdAt") AS "lastFail"
    FROM "AuditLog"
    WHERE "action" = 'auth.login.failed'
      AND "ip" IS NOT NULL
      AND "createdAt" >= ${windowStart}
    GROUP BY "ip"
    HAVING COUNT(*) > 20
  `;
  // dedupeKey con bucket de hora (fijo al reloj) para no spamear alertas
  // si la ráfaga continúa: una nueva alerta por IP cada hora máximo.
  const hourBucket = new Date(now);
  hourBucket.setUTCMinutes(0, 0, 0);
  const bucketKey = hourBucket.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return rows.map((r) => ({
    type: "LOGIN_ATTACK" as const,
    severity: Number(r.count) > 100 ? "CRITICAL" : "HIGH",
    title: `${Number(r.count)} intentos de login fallidos desde ${r.ip}`,
    description: `Detectados en ventana de 10 minutos terminando ${now.toISOString()}. Posible credential stuffing o brute force.`,
    data: {
      ip: r.ip,
      windowEnd: now.toISOString(),
      lastFailAt: r.lastFail.toISOString(),
      failedCount: Number(r.count),
    },
    dedupeKey: `login_attack:${r.ip}:${bucketKey}`,
  }));
}

// ============== STORE_TRAFFIC_DROP ==============

async function detectTrafficDrops(now: Date): Promise<AlertCandidate[]> {
  // Bucket de "esta semana" vs "semana anterior". Excluimos tiendas <14d.
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  type Row = { storeId: string; thisWeek: bigint; lastWeek: bigint };
  const rows = await db.$queryRaw<Row[]>`
    SELECT
      pv."storeId",
      COUNT(*) FILTER (WHERE pv."createdAt" >= ${weekAgo})::bigint AS "thisWeek",
      COUNT(*) FILTER (WHERE pv."createdAt" >= ${twoWeeksAgo} AND pv."createdAt" < ${weekAgo})::bigint AS "lastWeek"
    FROM "PageView" pv
    JOIN "Store" s ON s."id" = pv."storeId"
    WHERE s."createdAt" <= ${twoWeeksAgo}
      AND s."status" IN ('ACTIVE', 'PAST_DUE')
      AND pv."createdAt" >= ${twoWeeksAgo}
    GROUP BY pv."storeId"
    HAVING COUNT(*) FILTER (WHERE pv."createdAt" >= ${twoWeeksAgo} AND pv."createdAt" < ${weekAgo}) >= 50
       AND COUNT(*) FILTER (WHERE pv."createdAt" >= ${weekAgo})
           < 0.5 * COUNT(*) FILTER (WHERE pv."createdAt" >= ${twoWeeksAgo} AND pv."createdAt" < ${weekAgo})
  `;

  // Bucket de la semana para que el dedupeKey sea estable durante 7 días.
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekKey = weekStart.toISOString().slice(0, 10);

  return rows.map((r) => {
    const drop = 1 - Number(r.thisWeek) / Number(r.lastWeek);
    const dropPct = Math.round(drop * 100);
    return {
      type: "STORE_TRAFFIC_DROP" as const,
      severity: dropPct > 80 ? "HIGH" : "MEDIUM",
      title: `Caída de tráfico ${dropPct}% en una tienda`,
      description: `${Number(r.thisWeek)} pageviews esta semana vs ${Number(r.lastWeek)} la semana pasada.`,
      data: {
        thisWeek: Number(r.thisWeek),
        lastWeek: Number(r.lastWeek),
        dropPct,
      },
      storeId: r.storeId,
      dedupeKey: `traffic_drop:${r.storeId}:${weekKey}`,
    };
  });
}
