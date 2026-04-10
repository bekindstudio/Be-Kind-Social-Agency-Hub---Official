import { eq, sql, lt, desc } from "drizzle-orm";
import {
  db,
  trashLogTable,
  clientsTable,
  contractsTable,
  contractTemplatesTable,
  contractDocumentsTable,
  quoteTemplatesTable,
  editorialPlansTable,
  editorialSlotsTable,
  contentCategoriesTable,
  editorialTemplatesTable,
  projectsTable,
  tasksTable,
} from "@workspace/db";

export const TRASH_TABLE_NAMES = [
  "clients",
  "contracts",
  "contract_templates",
  "contract_documents",
  "quote_templates",
  "editorial_plans",
  "editorial_slots",
  "content_categories",
  "editorial_templates",
  "projects",
  "tasks",
] as const;

export type TrashTableName = (typeof TRASH_TABLE_NAMES)[number];

export function isTrashTableName(s: string): s is TrashTableName {
  return (TRASH_TABLE_NAMES as readonly string[]).includes(s);
}

function labelForRow(tableName: TrashTableName, row: Record<string, unknown>): string {
  switch (tableName) {
    case "clients":
      return String((row as { name?: string }).name ?? "Cliente");
    case "contracts":
      return String((row as { numero?: string; oggetto?: string }).numero ?? (row as { oggetto?: string }).oggetto ?? "Contratto cliente");
    case "contract_templates":
      return String((row as { name?: string }).name ?? "Template contratto");
    case "contract_documents":
      return String((row as { contractNumber?: string; clientName?: string }).contractNumber ?? (row as { clientName?: string }).clientName ?? "Contratto");
    case "quote_templates":
      return String((row as { name?: string }).name ?? "Preventivo");
    case "editorial_plans": {
      const r = row as { month?: number; year?: number; clientId?: number };
      return `Piano ${r.month ?? "?"}/${r.year ?? "?"}`;
    }
    case "editorial_slots":
      return String((row as { title?: string }).title ?? (row as { publishDate?: string }).publishDate ?? "Post");
    case "content_categories":
      return String((row as { name?: string }).name ?? "Categoria");
    case "editorial_templates":
      return String((row as { name?: string }).name ?? "Template editoriale");
    case "projects":
      return String((row as { name?: string }).name ?? "Progetto");
    case "tasks":
      return String((row as { title?: string }).title ?? "Task");
    default:
      return "Elemento";
  }
}

export async function softDeleteRecord(
  tableName: TrashTableName,
  recordId: string,
  opts?: { deletedBy?: string | null; recordLabel?: string | null },
): Promise<{ ok: true; trashLogId: string } | { ok: false; error: string }> {
  const now = new Date();
  const deletedBy = opts?.deletedBy ?? null;

  try {
    switch (tableName) {
      case "clients": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(clientsTable).set({ deletedAt: now }).where(eq(clientsTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "contracts": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(contractsTable).set({ deletedAt: now }).where(eq(contractsTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "contract_templates": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(contractTemplatesTable).where(eq(contractTemplatesTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(contractTemplatesTable).set({ deletedAt: now }).where(eq(contractTemplatesTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "contract_documents": {
        const [row] = await db.select().from(contractDocumentsTable).where(eq(contractDocumentsTable.id, recordId));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(contractDocumentsTable).set({ deletedAt: now, updatedAt: now }).where(eq(contractDocumentsTable.id, recordId));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "quote_templates": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(quoteTemplatesTable).where(eq(quoteTemplatesTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(quoteTemplatesTable).set({ deletedAt: now }).where(eq(quoteTemplatesTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "editorial_plans": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(editorialPlansTable).where(eq(editorialPlansTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(editorialPlansTable).set({ deletedAt: now }).where(eq(editorialPlansTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "editorial_slots": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(editorialSlotsTable).where(eq(editorialSlotsTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(editorialSlotsTable).set({ deletedAt: now }).where(eq(editorialSlotsTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "content_categories": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(contentCategoriesTable).where(eq(contentCategoriesTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(contentCategoriesTable).set({ deletedAt: now }).where(eq(contentCategoriesTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "editorial_templates": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(editorialTemplatesTable).where(eq(editorialTemplatesTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(editorialTemplatesTable).set({ deletedAt: now }).where(eq(editorialTemplatesTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "projects": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(projectsTable).set({ deletedAt: now }).where(eq(projectsTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      case "tasks": {
        const id = Number(recordId);
        if (!Number.isFinite(id)) return { ok: false, error: "ID non valido" };
        const [row] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
        if (!row) return { ok: false, error: "Non trovato" };
        if (row.deletedAt) return { ok: false, error: "Già nel cestino" };
        const label = opts?.recordLabel ?? labelForRow(tableName, row as any);
        await db.update(tasksTable).set({ deletedAt: now }).where(eq(tasksTable.id, id));
        const [log] = await db
          .insert(trashLogTable)
          .values({ tableName, recordId, recordLabel: label, deletedBy })
          .returning();
        return { ok: true, trashLogId: log.id };
      }
      default:
        return { ok: false, error: "Tabella non supportata" };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Errore durante lo spostamento nel cestino" };
  }
}

export async function restoreByTrashLogId(
  trashLogId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [log] = await db.select().from(trashLogTable).where(eq(trashLogTable.id, trashLogId));
  if (!log) return { ok: false, error: "Voce cestino non trovata" };
  if (!isTrashTableName(log.tableName)) return { ok: false, error: "Tipo non valido" };
  const tableName = log.tableName;
  const recordId = log.recordId;

  try {
    switch (tableName) {
      case "clients":
        await db.update(clientsTable).set({ deletedAt: null }).where(eq(clientsTable.id, Number(recordId)));
        break;
      case "contracts":
        await db.update(contractsTable).set({ deletedAt: null }).where(eq(contractsTable.id, Number(recordId)));
        break;
      case "contract_templates":
        await db.update(contractTemplatesTable).set({ deletedAt: null }).where(eq(contractTemplatesTable.id, Number(recordId)));
        break;
      case "contract_documents":
        await db
          .update(contractDocumentsTable)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(contractDocumentsTable.id, recordId));
        break;
      case "quote_templates":
        await db.update(quoteTemplatesTable).set({ deletedAt: null }).where(eq(quoteTemplatesTable.id, Number(recordId)));
        break;
      case "editorial_plans":
        await db.update(editorialPlansTable).set({ deletedAt: null }).where(eq(editorialPlansTable.id, Number(recordId)));
        break;
      case "editorial_slots":
        await db.update(editorialSlotsTable).set({ deletedAt: null }).where(eq(editorialSlotsTable.id, Number(recordId)));
        break;
      case "content_categories":
        await db.update(contentCategoriesTable).set({ deletedAt: null }).where(eq(contentCategoriesTable.id, Number(recordId)));
        break;
      case "editorial_templates":
        await db.update(editorialTemplatesTable).set({ deletedAt: null }).where(eq(editorialTemplatesTable.id, Number(recordId)));
        break;
      case "projects":
        await db.update(projectsTable).set({ deletedAt: null }).where(eq(projectsTable.id, Number(recordId)));
        break;
      case "tasks":
        await db.update(tasksTable).set({ deletedAt: null }).where(eq(tasksTable.id, Number(recordId)));
        break;
      default:
        return { ok: false, error: "Tabella non supportata" };
    }
    await db.delete(trashLogTable).where(eq(trashLogTable.id, trashLogId));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Errore ripristino" };
  }
}

async function hardDeleteRow(tableName: TrashTableName, recordId: string): Promise<void> {
  switch (tableName) {
    case "clients":
      await db.delete(clientsTable).where(eq(clientsTable.id, Number(recordId)));
      return;
    case "contracts":
      await db.delete(contractsTable).where(eq(contractsTable.id, Number(recordId)));
      return;
    case "contract_templates":
      await db.delete(contractTemplatesTable).where(eq(contractTemplatesTable.id, Number(recordId)));
      return;
    case "contract_documents":
      await db.delete(contractDocumentsTable).where(eq(contractDocumentsTable.id, recordId));
      return;
    case "quote_templates":
      await db.delete(quoteTemplatesTable).where(eq(quoteTemplatesTable.id, Number(recordId)));
      return;
    case "editorial_plans": {
      const pid = Number(recordId);
      await db.delete(editorialSlotsTable).where(eq(editorialSlotsTable.planId, pid));
      await db.delete(editorialPlansTable).where(eq(editorialPlansTable.id, pid));
      return;
    }
    case "editorial_slots":
      await db.delete(editorialSlotsTable).where(eq(editorialSlotsTable.id, Number(recordId)));
      return;
    case "content_categories":
      await db.delete(contentCategoriesTable).where(eq(contentCategoriesTable.id, Number(recordId)));
      return;
    case "editorial_templates":
      await db.delete(editorialTemplatesTable).where(eq(editorialTemplatesTable.id, Number(recordId)));
      return;
    case "projects":
      await db.delete(projectsTable).where(eq(projectsTable.id, Number(recordId)));
      return;
    case "tasks":
      await db.delete(tasksTable).where(eq(tasksTable.id, Number(recordId)));
      return;
    default:
      throw new Error("Tabella non supportata");
  }
}

export async function permanentDeleteByTrashLogId(
  trashLogId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [log] = await db.select().from(trashLogTable).where(eq(trashLogTable.id, trashLogId));
  if (!log) return { ok: false, error: "Voce cestino non trovata" };
  if (!isTrashTableName(log.tableName)) return { ok: false, error: "Tipo non valido" };

  try {
    await hardDeleteRow(log.tableName, log.recordId);
    await db.delete(trashLogTable).where(eq(trashLogTable.id, trashLogId));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Eliminazione definitiva fallita" };
  }
}

export async function listTrashLogs(): Promise<(typeof trashLogTable.$inferSelect)[]> {
  return db.select().from(trashLogTable).orderBy(desc(trashLogTable.deletedAt));
}

export async function countTrashLogs(): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(trashLogTable);
  return Number(rows[0]?.c ?? 0);
}

export async function emptyTrashPermanent(): Promise<{ deleted: number; errors: string[] }> {
  const logs = await listTrashLogs();
  const errors: string[] = [];
  let deleted = 0;
  for (const log of logs) {
    const r = await permanentDeleteByTrashLogId(log.id);
    if (r.ok) deleted++;
    else errors.push(`${log.recordLabel ?? log.id}: ${r.error}`);
  }
  return { deleted, errors };
}

/** Rimuove dal cestino i record oltre la soglia (solo log + hard delete se ancora soft-deleted). */
export async function purgeTrashOlderThanDays(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const old = await db.select().from(trashLogTable).where(lt(trashLogTable.deletedAt, cutoff));
  let n = 0;
  for (const log of old) {
    const r = await permanentDeleteByTrashLogId(log.id);
    if (r.ok) n++;
  }
  return n;
}
