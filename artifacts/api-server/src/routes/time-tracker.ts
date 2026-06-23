import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db, timeEntriesTable, clientsTable, projectsTable, tasksTable } from "@workspace/db";
import { getUserId } from "../lib/access-control";
import { validate } from "../middlewares/validate";

/**
 * Time tracking PERSONALE: ogni utente registra quanto tempo ha lavorato, su
 * quale cliente/progetto/task e con che tipo di attività. Voci manuali (isManual)
 * inserite a fine giornata. Il report mensile (aggregazione per cliente/progetto/
 * categoria) viene calcolato lato frontend a partire dall'elenco voci.
 *
 * Ogni record è privato all'owner (userId === currentUser). Niente ACL
 * multi-tenant: è il diario tempo dell'utente.
 */
const router: IRouter = Router();

const createSchema = z.object({
  clientId: z.union([z.number(), z.null()]).optional(),
  projectId: z.union([z.number(), z.null()]).optional(),
  taskId: z.union([z.number(), z.null()]).optional(),
  description: z.string().max(2000).optional().nullable(),
  activityType: z.string().max(60).optional().nullable(),
  // Data del lavoro (YYYY-MM-DD). L'ora non conta per una voce manuale: la
  // fissiamo a mezzogiorno per evitare slittamenti di giorno per timezone.
  date: z.string().min(1),
  // Cap generoso (1000h): una voce può rappresentare anche un totale mensile su
  // un progetto, non solo una singola sessione.
  durationMinutes: z.number().int().min(1).max(1000 * 60),
  isBillable: z.boolean().optional(),
}).passthrough();

function requireUserId(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  return userId;
}

function serialize(
  e: typeof timeEntriesTable.$inferSelect,
  clientName: string | null,
  projectName: string | null,
  taskTitle: string | null,
) {
  return {
    id: e.id,
    clientId: e.clientId,
    projectId: e.projectId,
    taskId: e.taskId,
    clientName,
    projectName,
    taskTitle,
    description: e.description,
    activityType: e.activityType,
    startedAt: e.startedAt?.toISOString?.() ?? null,
    durationSeconds: e.durationSeconds,
    durationMinutes: Math.round((e.durationSeconds ?? 0) / 60),
    isBillable: e.isBillable,
    isManual: e.isManual,
    createdAt: e.createdAt?.toISOString?.() ?? null,
  };
}

// GET /api/time-entries?from=&to=  → voci dell'utente nella finestra (per data).
router.get("/time-entries", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const fromRaw = typeof req.query.from === "string" ? req.query.from : null;
  const toRaw = typeof req.query.to === "string" ? req.query.to : null;
  const conds = [eq(timeEntriesTable.userId, userId)];
  if (fromRaw) {
    const d = new Date(fromRaw);
    if (Number.isFinite(d.getTime())) conds.push(gte(timeEntriesTable.startedAt, d));
  }
  if (toRaw) {
    const d = new Date(toRaw);
    if (Number.isFinite(d.getTime())) conds.push(lte(timeEntriesTable.startedAt, d));
  }
  const rows = await db
    .select()
    .from(timeEntriesTable)
    .where(and(...conds))
    .orderBy(desc(timeEntriesTable.startedAt));

  // Risolvo i nomi (cliente/progetto/task) per il report e le righe.
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((v): v is number => v != null))];
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((v): v is number => v != null))];
  const taskIds = [...new Set(rows.map((r) => r.taskId).filter((v): v is number => v != null))];

  const clientMap = new Map<number, string>();
  const projectMap = new Map<number, string>();
  const taskMap = new Map<number, string>();
  if (clientIds.length) {
    for (const c of await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds))) {
      clientMap.set(c.id, c.name);
    }
  }
  if (projectIds.length) {
    for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, projectIds))) {
      projectMap.set(p.id, p.name);
    }
  }
  if (taskIds.length) {
    for (const t of await db.select({ id: tasksTable.id, title: tasksTable.title }).from(tasksTable).where(inArray(tasksTable.id, taskIds))) {
      taskMap.set(t.id, t.title);
    }
  }

  res.json(rows.map((r) => serialize(
    r,
    r.clientId != null ? (clientMap.get(r.clientId) ?? null) : null,
    r.projectId != null ? (projectMap.get(r.projectId) ?? null) : null,
    r.taskId != null ? (taskMap.get(r.taskId) ?? null) : null,
  )));
});

// POST /api/time-entries  → nuova voce manuale.
router.post("/time-entries", validate(createSchema), async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as z.infer<typeof createSchema>;

  const startedAt = new Date(`${body.date}T12:00:00`);
  if (!Number.isFinite(startedAt.getTime())) {
    res.status(400).json({ error: "Data non valida" });
    return;
  }
  const durationSeconds = Math.round(body.durationMinutes * 60);

  const [created] = await db.insert(timeEntriesTable).values({
    userId,
    clientId: body.clientId ?? null,
    projectId: body.projectId ?? null,
    taskId: body.taskId ?? null,
    description: body.description?.trim() || null,
    activityType: body.activityType?.trim() || null,
    startedAt,
    endedAt: null,
    durationSeconds,
    isManual: true,
    isBillable: body.isBillable ?? true,
  }).returning();

  // Nomi per la riga restituita.
  const clientName = created.clientId != null
    ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, created.clientId)))[0]?.name ?? null
    : null;
  const projectName = created.projectId != null
    ? (await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, created.projectId)))[0]?.name ?? null
    : null;
  const taskTitle = created.taskId != null
    ? (await db.select({ title: tasksTable.title }).from(tasksTable).where(eq(tasksTable.id, created.taskId)))[0]?.title ?? null
    : null;

  res.status(201).json(serialize(created, clientName, projectName, taskTitle));
});

// DELETE /api/time-entries/:id  → elimina (solo dell'owner).
router.delete("/time-entries/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  await db
    .delete(timeEntriesTable)
    .where(and(eq(timeEntriesTable.id, id), eq(timeEntriesTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
