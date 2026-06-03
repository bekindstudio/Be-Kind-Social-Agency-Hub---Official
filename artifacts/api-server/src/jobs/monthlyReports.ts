import { eq, and, desc, isNull } from "drizzle-orm";
import { db, clientReportsTable, clientsTable, projectsTable } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Genera in bozza un report mensile per ogni cliente attivo, riferito al MESE
 * PRECEDENTE rispetto alla data di esecuzione del cron.
 *
 * Idempotente: se per quel cliente + period esiste già un report (in
 * qualunque stato), lo skippa silenziosamente. Questo permette di rilanciare
 * il job manualmente senza creare duplicati.
 *
 * Cliente "attivo" = non soft-deleted + ha almeno un progetto attivo o
 * completato negli ultimi 90 giorni. Filtro conservativo per non generare
 * report inutili sui clienti dormienti.
 */
export async function generateMonthlyReportDrafts(now: Date = new Date()): Promise<{
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
}> {
  // Calcola il mese precedente (es. esecuzione 1 giugno → period "2026-05")
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const periodLabel = prevMonth.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const periodoInizio = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
  const periodoFine = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  // Clienti non cancellati
  const clients = await db
    .select({ id: clientsTable.id, name: clientsTable.name, reportRecipientEmail: clientsTable.reportRecipientEmail })
    .from(clientsTable)
    .where(isNull(clientsTable.deletedAt));

  // Filtra: ha almeno un progetto non-archiviato e non-cancellato
  const projects = await db
    .select({ id: projectsTable.id, clientId: projectsTable.clientId, status: projectsTable.status })
    .from(projectsTable)
    .where(isNull(projectsTable.deletedAt));
  const activeClientIds = new Set(
    projects
      .filter((p) => p.clientId != null && p.status !== "archived")
      .map((p) => Number(p.clientId)),
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;

  for (const c of clients) {
    if (!activeClientIds.has(c.id)) continue;
    scanned += 1;

    // Skip se esiste già un report per (clientId, period)
    const existing = await db
      .select({ id: clientReportsTable.id })
      .from(clientReportsTable)
      .where(and(eq(clientReportsTable.clientId, c.id), eq(clientReportsTable.period, period)))
      .limit(1);
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    try {
      await db.insert(clientReportsTable).values({
        clientId: c.id,
        tipo: "mensile",
        period,
        periodLabel,
        periodoInizio,
        periodoFine,
        status: "bozza",
        titolo: `Report ${periodLabel} · ${c.name}`,
        riepilogoEsecutivo: `Bozza generata automaticamente il ${new Date().toLocaleDateString("it-IT")}. Aggiungi qui i highlight del mese di ${periodLabel}.`,
        analisiInsights: "",
        strategiaProssimoPeriodo: "",
        noteAggiuntive: "",
        recipientEmail: c.reportRecipientEmail ?? null,
        subject: `Report ${periodLabel} - ${c.name}`,
        createdBy: "cron:monthly-reports",
      });
      created += 1;
    } catch (err) {
      // B15: log esplicito di message + nome cliente per diagnosi rapida
      // (l'oggetto err da solo è spesso un blob illeggibile nei log JSON).
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err, message, clientId: c.id, clientName: c.name, period }, "monthly-reports: insert bozza fallito per cliente");
      failed += 1;
    }
  }

  logger.info({ scanned, created, skipped, failed, period }, "monthly-reports: drafts generation completed");
  return { scanned, created, skipped, failed };
}
