import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  listTrashLogs,
  countTrashLogs,
  restoreByTrashLogId,
  permanentDeleteByTrashLogId,
  emptyTrashPermanent,
  purgeTrashOlderThanDays,
  isTrashTableName,
} from "../lib/trash-service";
import { getUserId, isEnvAdmin } from "../lib/access-control";

const router: IRouter = Router();

const TRASH_RETENTION_DAYS = 30;

const typeMeta: Record<
  string,
  { kind: string; label: string }
> = {
  clients: { kind: "client", label: "Cliente" },
  contracts: { kind: "client_contract", label: "Contratto cliente" },
  contract_templates: { kind: "contract_template", label: "Template contratto" },
  contract_documents: { kind: "contract_doc", label: "Contratto (documento)" },
  quote_templates: { kind: "quote", label: "Preventivo" },
  editorial_plans: { kind: "editorial_plan", label: "Piano editoriale" },
  editorial_slots: { kind: "editorial_slot", label: "Post / slot" },
  content_categories: { kind: "category", label: "Categoria contenuti" },
  editorial_templates: { kind: "editorial_template", label: "Template editoriale" },
  projects: { kind: "project", label: "Progetto" },
  tasks: { kind: "task", label: "Task" },
};

function enrichLog(row: {
  id: string;
  tableName: string;
  recordId: string;
  recordLabel: string | null;
  deletedBy: string | null;
  deletedAt: Date;
}) {
  const meta = isTrashTableName(row.tableName) ? typeMeta[row.tableName] : { kind: "unknown", label: row.tableName };
  const deletedAt = row.deletedAt instanceof Date ? row.deletedAt : new Date(row.deletedAt as any);
  const msPerDay = 86400000;
  const ageDays = Math.floor((Date.now() - deletedAt.getTime()) / msPerDay);
  const daysRemaining = TRASH_RETENTION_DAYS - ageDays;
  const progressPct = Math.max(0, Math.min(100, (daysRemaining / TRASH_RETENTION_DAYS) * 100));
  return {
    id: row.id,
    tableName: row.tableName,
    recordId: row.recordId,
    recordLabel: row.recordLabel,
    deletedBy: row.deletedBy,
    deletedAt: deletedAt.toISOString(),
    typeKind: meta.kind,
    typeLabel: meta.label,
    retentionDays: TRASH_RETENTION_DAYS,
    daysRemaining,
    progressPct,
    isExpiredRetention: daysRemaining <= 0,
  };
}

router.get("/trash", async (req, res): Promise<void> => {
  const typeFilter = typeof req.query.type === "string" ? req.query.type.trim() : "";
  const qSearch = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";

  let rows = await listTrashLogs();

  if (typeFilter && isTrashTableName(typeFilter)) {
    rows = rows.filter((r) => r.tableName === typeFilter);
  } else if (typeFilter) {
    rows = rows.filter((r) => typeMeta[r.tableName]?.kind === typeFilter);
  }

  if (qSearch) {
    rows = rows.filter(
      (r) =>
        (r.recordLabel ?? "").toLowerCase().includes(qSearch) ||
        r.recordId.toLowerCase().includes(qSearch),
    );
  }

  if (from) {
    const t = new Date(from).getTime();
    if (!isNaN(t)) rows = rows.filter((r) => new Date(r.deletedAt as any).getTime() >= t);
  }
  if (to) {
    const t = new Date(to).getTime();
    if (!isNaN(t)) rows = rows.filter((r) => new Date(r.deletedAt as any).getTime() <= t + 86400000);
  }

  res.json(rows.map(enrichLog));
});

router.get("/trash/count", async (_req, res): Promise<void> => {
  const count = await countTrashLogs();
  res.json({ count });
});

const trashIdParams = z.object({ id: z.string().uuid() });

router.post("/trash/:id/restore", async (req, res): Promise<void> => {
  const parsed = trashIdParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const r = await restoreByTrashLogId(parsed.data.id);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, message: "Elemento ripristinato con successo" });
});

router.delete("/trash/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Operazione riservata agli amministratori" });
    return;
  }
  const parsed = trashIdParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const r = await permanentDeleteByTrashLogId(parsed.data.id);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, message: "Eliminato definitivamente" });
});

router.post("/trash/empty", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Operazione riservata agli amministratori" });
    return;
  }
  const body = z.object({ confirm: z.literal(true) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invia { "confirm": true } per confermare' });
    return;
  }
  const { deleted, errors } = await emptyTrashPermanent();
  res.json({ ok: true, deleted, errors });
});

/** Chiamata da cron Supabase o manuale: elimina definitivamente oltre 30 giorni. */
router.post("/trash/purge-expired", async (req, res): Promise<void> => {
  const secret = process.env.TRASH_PURGE_SECRET;
  const header = req.headers["x-trash-purge-secret"];
  const userId = getUserId(req);
  const allowed = (secret && header === secret) || (userId && isEnvAdmin(userId));
  if (!allowed) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  const days = typeof req.body?.days === "number" ? req.body.days : TRASH_RETENTION_DAYS;
  const n = await purgeTrashOlderThanDays(days);
  res.json({ purged: n });
});

export default router;
