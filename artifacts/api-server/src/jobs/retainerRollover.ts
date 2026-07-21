import { and, eq, isNull, inArray } from "drizzle-orm";
import { db, clientRetainerTasksTable, clientsTable, tasksTable } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Materializza in `tasks` il lavoro ricorrente del retainer per il mese CORRENTE.
 *
 * Idempotente per costruzione: l'unique index (retainer_task_id, retainer_period)
 * fa sì che rilanciare il job non duplichi niente. Serve perché il job va anche
 * lanciato a mano — dal cockpit cliente o quando si aggiunge un modello a mese
 * già iniziato — non solo dal cron del 1°.
 *
 * Perché il mese corrente e non il precedente (al contrario di monthlyReports):
 * i report guardano indietro a quello che è successo, il retainer guarda avanti
 * a quello che c'è da fare.
 */
export async function runRetainerRollover(
  now: Date = new Date(),
  opts: { clientId?: number } = {},
): Promise<{ period: string; scanned: number; created: number; skipped: number; failed: number }> {
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Solo clienti vivi: un cliente cestinato non deve continuare a generare lavoro.
  const clients = await db
    .select({ id: clientsTable.id, name: clientsTable.name })
    .from(clientsTable)
    .where(isNull(clientsTable.deletedAt));
  const liveClientIds = new Set(clients.map((c) => c.id));
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));

  const models = await db
    .select()
    .from(clientRetainerTasksTable)
    .where(
      opts.clientId != null
        ? and(eq(clientRetainerTasksTable.active, true), eq(clientRetainerTasksTable.clientId, opts.clientId))
        : eq(clientRetainerTasksTable.active, true),
    );

  const applicable = models.filter((m) => liveClientIds.has(m.clientId));

  // Una sola query per sapere cosa è già stato generato: con 10 clienti × 4
  // modelli sarebbero 40 SELECT dentro il loop.
  const existing = applicable.length > 0
    ? await db
      .select({ retainerTaskId: tasksTable.retainerTaskId })
      .from(tasksTable)
      .where(and(
        eq(tasksTable.retainerPeriod, period),
        inArray(tasksTable.retainerTaskId, applicable.map((m) => m.id)),
      ))
    : [];
  // NB: si contano anche le task cestinate (nessun filtro su deletedAt). Se hai
  // cancellato la task del mese non deve ricomparire al primo rilancio del job.
  const alreadyDone = new Set(existing.map((e) => e.retainerTaskId));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of applicable) {
    if (alreadyDone.has(m.id)) {
      skipped += 1;
      continue;
    }
    const dueDate = `${period}-${String(m.dayOfMonth).padStart(2, "0")}`;
    try {
      await db.insert(tasksTable).values({
        clientId: m.clientId,
        title: m.title,
        description: m.description,
        categoria: m.categoria,
        priority: m.priority,
        estimatedHours: m.estimatedHours,
        assigneeId: m.assigneeId,
        dueDate,
        status: "todo",
        tipo: "semplice",
        retainerTaskId: m.id,
        retainerPeriod: period,
        createdBy: "cron:retainer-rollover",
      });
      created += 1;
    } catch (err) {
      // Una violazione di unique qui non è un errore: è due esecuzioni in
      // parallelo. La distinguiamo per non sporcare i log con falsi allarmi.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("tasks_retainer_unique_idx") || message.includes("duplicate key")) {
        skipped += 1;
        continue;
      }
      logger.warn(
        { err, message, clientId: m.clientId, clientName: clientNames.get(m.clientId), modelId: m.id, period },
        "retainer-rollover: creazione task fallita",
      );
      failed += 1;
    }
  }

  logger.info({ period, scanned: applicable.length, created, skipped, failed }, "retainer-rollover: completato");
  return { period, scanned: applicable.length, created, skipped, failed };
}
