import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, lt, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, clientRetainerTasksTable, clientBillingTable, timeEntriesTable, tasksTable } from "@workspace/db";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";
import { validate } from "../middlewares/validate";
import { runRetainerRollover } from "../jobs/retainerRollover";

/**
 * Il retainer mensile di un cliente: il modello del lavoro ricorrente e la
 * risposta alla domanda che conta — "questo cliente rende o mi costa?".
 */
const router: IRouter = Router();

const createModelSchema = z.object({
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(5000).nullable().optional(),
  categoria: z.string().trim().max(120).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  estimatedHours: z.number().int().min(1).max(500).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
}).passthrough();

const updateModelSchema = createModelSchema.partial().passthrough();

async function checkClientAccess(req: Request, res: Response): Promise<{ userId: string; clientId: number } | null> {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return null; }
  const clientId = parseInt(req.params.clientId as string, 10);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    res.status(400).json({ error: "ID cliente non valido" });
    return null;
  }
  const accessible = await getAccessibleClientIds(userId);
  if (accessible !== "all" && !accessible.includes(clientId)) {
    res.status(403).json({ error: "Accesso non autorizzato a questo cliente" });
    return null;
  }
  return { userId, clientId };
}

function serialize(m: typeof clientRetainerTasksTable.$inferSelect) {
  return {
    ...m,
    createdAt: m.createdAt?.toISOString?.() ?? null,
    updatedAt: m.updatedAt?.toISOString?.() ?? null,
  };
}

/** Primo e ultimo istante del mese YYYY-MM, per le query sulle ore. */
function monthBounds(period: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

router.get("/clients/:clientId/retainer/models", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const rows = await db
    .select()
    .from(clientRetainerTasksTable)
    .where(eq(clientRetainerTasksTable.clientId, ctx.clientId))
    .orderBy(clientRetainerTasksTable.dayOfMonth, clientRetainerTasksTable.id);
  res.json(rows.map(serialize));
});

router.post("/clients/:clientId/retainer/models", validate(createModelSchema), async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const d = req.body as z.infer<typeof createModelSchema>;
  const [row] = await db.insert(clientRetainerTasksTable).values({
    clientId: ctx.clientId,
    title: d.title,
    description: d.description ?? null,
    categoria: d.categoria ?? null,
    dayOfMonth: d.dayOfMonth ?? 1,
    estimatedHours: d.estimatedHours ?? null,
    priority: d.priority ?? "medium",
    assigneeId: d.assigneeId ?? null,
    active: d.active ?? true,
    createdBy: ctx.userId,
  }).returning();
  res.status(201).json(serialize(row));
});

router.patch("/clients/:clientId/retainer/models/:modelId", validate(updateModelSchema), async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const modelId = parseInt(req.params.modelId as string, 10);
  if (!Number.isFinite(modelId)) { res.status(400).json({ error: "ID modello non valido" }); return; }
  const d = req.body as z.infer<typeof updateModelSchema>;
  const updates: Record<string, unknown> = {};
  for (const key of ["title", "description", "categoria", "dayOfMonth", "estimatedHours", "priority", "assigneeId", "active"] as const) {
    if (d[key] !== undefined) updates[key] = d[key];
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }
  // clientId nella WHERE: senza, un id indovinato modificherebbe il modello di
  // un altro cliente nonostante il controllo di accesso sul path.
  const [row] = await db
    .update(clientRetainerTasksTable)
    .set(updates)
    .where(and(eq(clientRetainerTasksTable.id, modelId), eq(clientRetainerTasksTable.clientId, ctx.clientId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Modello non trovato" }); return; }
  res.json(serialize(row));
});

router.delete("/clients/:clientId/retainer/models/:modelId", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const modelId = parseInt(req.params.modelId as string, 10);
  if (!Number.isFinite(modelId)) { res.status(400).json({ error: "ID modello non valido" }); return; }
  const [row] = await db
    .delete(clientRetainerTasksTable)
    .where(and(eq(clientRetainerTasksTable.id, modelId), eq(clientRetainerTasksTable.clientId, ctx.clientId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Modello non trovato" }); return; }
  // Le task già generate restano: sono lavoro fatto, non vanno riscritte.
  res.json({ ok: true });
});

/**
 * La domanda economica del retainer: ore incluse, ore fatte, canone, e quindi
 * quanto stai davvero incassando all'ora questo mese.
 */
router.get("/clients/:clientId/retainer/summary", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const period = typeof req.query.period === "string" && req.query.period
    ? req.query.period
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const bounds = monthBounds(period);
  if (!bounds) { res.status(400).json({ error: "Periodo non valido, atteso YYYY-MM" }); return; }

  const [billing] = await db
    .select({ valoreMensile: clientBillingTable.valoreMensile, oreIncluse: clientBillingTable.oreIncluse })
    .from(clientBillingTable)
    .where(eq(clientBillingTable.clientId, ctx.clientId))
    .limit(1);

  // Ore del mese dal time tracker. Fatturabili e non separate: sommarle insieme
  // gonfierebbe il consuntivo con le call commerciali e i rifacimenti gratis.
  const [hours] = await db
    .select({
      billableSeconds: sql<number>`coalesce(sum(case when ${timeEntriesTable.isBillable} then ${timeEntriesTable.durationSeconds} else 0 end), 0)`,
      nonBillableSeconds: sql<number>`coalesce(sum(case when ${timeEntriesTable.isBillable} then 0 else ${timeEntriesTable.durationSeconds} end), 0)`,
    })
    .from(timeEntriesTable)
    .where(and(
      eq(timeEntriesTable.clientId, ctx.clientId),
      gte(timeEntriesTable.startedAt, bounds.start),
      lt(timeEntriesTable.startedAt, bounds.end),
    ));

  // Stato delle task di retainer del mese: è la parte "il lavoro è stato fatto?".
  const retainerTasks = await db
    .select({ status: tasksTable.status })
    .from(tasksTable)
    .where(and(
      eq(tasksTable.clientId, ctx.clientId),
      eq(tasksTable.retainerPeriod, period),
      isNull(tasksTable.deletedAt),
    ));

  const billableHours = Number(hours?.billableSeconds ?? 0) / 3600;
  const nonBillableHours = Number(hours?.nonBillableSeconds ?? 0) / 3600;
  const oreIncluse = billing?.oreIncluse ?? null;
  const valoreMensile = billing?.valoreMensile ?? null;

  res.json({
    period,
    valoreMensile,
    oreIncluse,
    billableHours: Math.round(billableHours * 100) / 100,
    nonBillableHours: Math.round(nonBillableHours * 100) / 100,
    // Sforato solo se c'è un monte ore concordato: senza, "sforato" non vuol dire niente.
    oreSforate: oreIncluse != null ? Math.max(0, Math.round((billableHours - oreIncluse) * 100) / 100) : null,
    // Quanto stai incassando davvero all'ora. È il numero che dice se il
    // retainer regge, e va calcolato sulle ore fatte, non su quelle vendute.
    tariffaEffettiva: valoreMensile != null && billableHours > 0
      ? Math.round((valoreMensile / billableHours) * 100) / 100
      : null,
    taskTotali: retainerTasks.length,
    taskFatte: retainerTasks.filter((t) => t.status === "done").length,
  });
});

/**
 * Genera subito le task del retainer per questo cliente. Serve quando si
 * aggiunge un modello a mese già iniziato: aspettare il 1° del mese successivo
 * significherebbe perdere un mese di lavoro pianificato.
 */
router.post("/clients/:clientId/retainer/run", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  try {
    const stats = await runRetainerRollover(new Date(), { clientId: ctx.clientId });
    res.json({ ok: true, ...stats });
  } catch {
    res.status(500).json({ error: "Generazione non riuscita" });
  }
});

export default router;
