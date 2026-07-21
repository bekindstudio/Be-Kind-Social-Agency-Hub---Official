import { Router, type IRouter } from "express";
import { eq, sql, and, or, isNull, inArray, desc } from "drizzle-orm";
import { db, tasksTable, projectsTable, teamMembersTable, clientsTable, activityLog } from "@workspace/db";
import {
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  ListTasksQueryParams,
} from "@workspace/api-zod";
import { z } from "zod";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";
import { validate } from "../middlewares/validate";

const router: IRouter = Router();

const createTaskSchema = CreateTaskBody.extend({
  clientId: z.number().nullable().optional(),
  tipo: z.string().optional(),
  categoria: z.string().nullable().optional(),
  checklistJson: z.string().optional(),
  pacchettoContenuti: z.string().nullable().optional(),
  meseRiferimento: z.string().nullable().optional(),
}).passthrough();
/**
 * `UpdateTaskBody` (generato) non conosce clientId, quindi lo leggiamo a parte
 * invece che con un Number() sul body grezzo: così "abc" o 0 danno 400 dalla
 * validazione anziché un 500 da Postgres sulla colonna integer.
 */
const updateTaskExtraSchema = z.object({
  clientId: z.number().int().positive().nullable().optional(),
}).passthrough();

const createTaskCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  authorName: z.string().trim().min(1).max(255),
});

async function getLookupMaps(projectIds: number[], assigneeIds: number[], directClientIds: number[] = []) {
  const [projects, members] = await Promise.all([
    // NB: qui NON si filtra su deletedAt. Un progetto cestinato non deve far
    // sparire il cliente della task: l'appartenenza al cliente regge sia
    // l'etichetta in UI sia il filtro di autorizzazione più sotto. Filtrandolo,
    // la task risultava "Generale" e visibile a chi non ha accesso al cliente,
    // mentre GET /tasks/:id sullo stesso record rispondeva 403.
    projectIds.length > 0
      ? db
        .select({ id: projectsTable.id, name: projectsTable.name, clientId: projectsTable.clientId, deletedAt: projectsTable.deletedAt })
        .from(projectsTable)
        .where(inArray(projectsTable.id, projectIds))
      : Promise.resolve([]),
    assigneeIds.length > 0
      ? db
        .select({ id: teamMembersTable.id, name: teamMembersTable.name })
        .from(teamMembersTable)
        .where(inArray(teamMembersTable.id, assigneeIds))
      : Promise.resolve([]),
  ]);

  // Nomi cliente: servono sia per le task col cliente diretto sia per quelle che
  // lo ereditano dal progetto. Senza questa mappa la UI (Oggi, lista task) non
  // poteva mostrare di chi è la task e le marcava tutte come "Generale".
  const clientIds = Array.from(new Set([
    ...directClientIds,
    ...projects.map((p) => p.clientId).filter((id): id is number => id != null),
  ]));
  const clients = clientIds.length > 0
    ? await db
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable)
      .where(inArray(clientsTable.id, clientIds))
    : [];

  return {
    // Il NOME del progetto invece sì: di un progetto cestinato non lo mostriamo.
    projectMap: new Map(projects.filter((p) => p.deletedAt == null).map((p) => [p.id, p.name])),
    projectClientMap: new Map(projects.map((p) => [p.id, p.clientId ?? null])),
    memberMap: new Map(members.map((m) => [m.id, m.name])),
    clientMap: new Map(clients.map((c) => [c.id, c.name])),
  };
}

type LookupMaps = Awaited<ReturnType<typeof getLookupMaps>>;

function serializeTask(task: typeof tasksTable.$inferSelect, maps: LookupMaps) {
  // Cliente "effettivo": quello diretto sul task, altrimenti ereditato dal
  // progetto. `clientId` resta il valore grezzo (serve al form di modifica),
  // `effectiveClientId` + `clientName` sono ciò che la UI mostra.
  const effectiveClientId = task.clientId
    ?? (task.projectId != null ? maps.projectClientMap.get(task.projectId) ?? null : null);
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    projectName: task.projectId ? (maps.projectMap.get(task.projectId) ?? null) : null,
    assigneeName: task.assigneeId ? (maps.memberMap.get(task.assigneeId) ?? null) : null,
    effectiveClientId,
    clientName: effectiveClientId != null ? (maps.clientMap.get(effectiveClientId) ?? null) : null,
  };
}

async function enrichTask(task: typeof tasksTable.$inferSelect) {
  const maps = await getLookupMaps(
    task.projectId != null ? [task.projectId] : [],
    task.assigneeId != null ? [task.assigneeId] : [],
    task.clientId != null ? [task.clientId] : [],
  );
  return serializeTask(task, maps);
}

/** Cliente del progetto, per ereditarlo su una task che non ne dichiara uno. */
async function clientIdOfProject(projectId: number): Promise<number | null> {
  const [p] = await db
    .select({ clientId: projectsTable.clientId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  return p?.clientId ?? null;
}

/**
 * Cliente "effettivo" di un task: clientId diretto, altrimenti il clientId del
 * progetto collegato. Serve all'autorizzazione per-cliente (evita IDOR).
 */
async function taskEffectiveClientId(task: typeof tasksTable.$inferSelect): Promise<number | null> {
  if (task.clientId != null) return task.clientId;
  if (task.projectId != null) {
    const [p] = await db
      .select({ clientId: projectsTable.clientId })
      .from(projectsTable)
      .where(eq(projectsTable.id, task.projectId));
    return p?.clientId ?? null;
  }
  return null;
}

/** True se l'utente può operare sul task in base al cliente di appartenenza. */
async function userCanAccessTask(task: typeof tasksTable.$inferSelect, userId: string): Promise<boolean> {
  if (isEnvAdmin(userId)) return true;
  const accessible = await getAccessibleClientIds(userId);
  if (accessible === "all") return true;
  const cid = await taskEffectiveClientId(task);
  if (cid == null) return true; // task interni senza cliente → visibili al team
  return accessible.includes(cid);
}

/** Carica un task e verifica l'accesso. Ritorna lo status HTTP da usare in caso di errore. */
async function loadTaskIfAccessible(
  taskId: number,
  userId: string,
): Promise<{ ok: true; task: typeof tasksTable.$inferSelect } | { ok: false; status: 403 | 404 }> {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), isNull(tasksTable.deletedAt)));
  if (!task) return { ok: false, status: 404 };
  if (!(await userCanAccessTask(task, userId))) return { ok: false, status: 403 };
  return { ok: true, task };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const query = ListTasksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rawClientId = req.query.clientId;
  const clientId = rawClientId != null && rawClientId !== "" ? Number(rawClientId) : null;
  const conditions: any[] = [isNull(tasksTable.deletedAt)];
  if (query.data.projectId != null) conditions.push(eq(tasksTable.projectId, query.data.projectId));
  if (query.data.assigneeId != null) conditions.push(eq(tasksTable.assigneeId, query.data.assigneeId));
  if (query.data.status != null) conditions.push(eq(tasksTable.status, query.data.status));

  if (clientId != null && Number.isFinite(clientId)) {
    // B2: ACL su clientId query param. Senza questo check, un utente ristretto
    // poteva indovinare `?clientId=999` e leggere i task di un cliente non
    // accessibile (cross-tenant leak).
    const accessibleEarly = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId);
    if (accessibleEarly !== "all" && !accessibleEarly.includes(clientId)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
    const clientProjects = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(isNull(projectsTable.deletedAt), eq(projectsTable.clientId, clientId)));
    const clientProjectIds = clientProjects.map((row) => row.id);
    // Le task del cliente sono quelle col clientId DIRETTO (create dal cockpit
    // senza progetto) OPPURE quelle di un suo progetto. Prima si filtrava solo
    // per progetto → una task "Nessun progetto" spariva, e se il cliente non
    // aveva progetti si tornava [] anche con task dirette.
    const orParts = [eq(tasksTable.clientId, clientId)];
    if (clientProjectIds.length > 0) orParts.push(inArray(tasksTable.projectId, clientProjectIds));
    conditions.push(orParts.length === 1 ? orParts[0] : or(...orParts)!);
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions))
    .orderBy(tasksTable.createdAt);

  const projectIds = Array.from(new Set(tasks.map((task) => task.projectId).filter((id): id is number => id != null)));
  const assigneeIds = Array.from(new Set(tasks.map((task) => task.assigneeId).filter((id): id is number => id != null)));
  const directClientIds = Array.from(new Set(tasks.map((task) => task.clientId).filter((id): id is number => id != null)));
  const maps = await getLookupMaps(projectIds, assigneeIds, directClientIds);
  const { projectClientMap } = maps;

  // Autorizzazione per-cliente: un utente non-admin vede solo i task dei clienti
  // a cui ha accesso (cliente diretto del task o del progetto collegato). I task
  // senza cliente sono interni e restano visibili al team.
  const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId);
  const visibleTasks = accessible === "all"
    ? tasks
    : tasks.filter((task) => {
        const cid = task.clientId ?? (task.projectId != null ? projectClientMap.get(task.projectId) ?? null : null);
        return cid == null || accessible.includes(cid);
      });

  const result = visibleTasks.map((task) => serializeTask(task, maps));
  res.json(result);
});

router.post("/tasks", validate(createTaskSchema), async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const d = req.body as z.infer<typeof createTaskSchema>;
  const b = req.body as Record<string, unknown>;
  // Il cliente è sempre esplicito lato UI (o "Generale" = nessuno). Se però
  // arriva solo il progetto, ereditiamo il suo cliente: una task di progetto non
  // deve mai finire fra le "Generale".
  // Se c'è un progetto il cliente è SEMPRE il suo, anche se il body ne dichiara
  // un altro: altrimenti si potrebbe infilare la task nel progetto di un cliente
  // non accessibile dichiarando come "copertura" un cliente proprio.
  let clientId = d.clientId ?? null;
  if (d.projectId != null) {
    const fromProject = await clientIdOfProject(d.projectId);
    if (fromProject != null) clientId = fromProject;
  }
  if (clientId != null) {
    const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(clientId)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
  }
  const [task] = await db.insert(tasksTable).values({
    title: d.title,
    description: d.description ?? null,
    projectId: d.projectId ?? null,
    // Salva il cliente diretto: così una task creata senza progetto dal cockpit
    // resta legata al cliente e non sparisce dalla sua lista.
    clientId,
    assigneeId: d.assigneeId ?? null,
    status: d.status,
    priority: d.priority,
    dueDate: d.dueDate ?? null,
    tipo: (b.tipo as string) ?? "semplice",
    categoria: (b.categoria as string) ?? null,
    checklistJson: (b.checklistJson as string) ?? "[]",
    pacchettoContenuti: (b.pacchettoContenuti as string) ?? null,
    meseRiferimento: (b.meseRiferimento as string) ?? null,
  }).returning();
  const enriched = await enrichTask(task);
  res.status(201).json(enriched);
});

router.get("/tasks/:id/comments", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    res.status(400).json({ error: "Task ID non valido" });
    return;
  }
  const access = await loadTaskIfAccessible(taskId, userId);
  if (!access.ok) { res.status(access.status).json({ error: access.status === 404 ? "Task not found" : "Accesso non autorizzato" }); return; }

  const commentsResult = await db
    .execute(sql<{
      id: number;
      taskId: number;
      userId: string;
      authorName: string;
      content: string;
      createdAt: Date | string;
    }>`select
        id,
        task_id as "taskId",
        user_id as "userId",
        author_name as "authorName",
        content,
        created_at as "createdAt"
      from task_comments
      where task_id = ${taskId}
      order by created_at asc`);
  const comments = (Array.isArray((commentsResult as any)?.rows)
    ? (commentsResult as any).rows
    : Array.isArray(commentsResult)
      ? commentsResult
      : []) as Array<{
    id: number;
    taskId: number;
    userId: string;
    authorName: string;
    content: string;
    createdAt: Date | string;
  }>;

  res.json(comments.map((comment) => ({
    ...comment,
    createdAt: new Date(comment.createdAt).toISOString(),
  })));
});

router.post("/tasks/:id/comments", validate(createTaskCommentSchema), async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    res.status(400).json({ error: "Task ID non valido" });
    return;
  }

  const access = await loadTaskIfAccessible(taskId, userId);
  if (!access.ok) { res.status(access.status).json({ error: access.status === 404 ? "Task not found" : "Accesso non autorizzato" }); return; }

  const { content, authorName } = req.body as z.infer<typeof createTaskCommentSchema>;
  const insertedResult = await db.execute(sql<{
    id: number;
    taskId: number;
    userId: string;
    authorName: string;
    content: string;
    createdAt: Date | string;
  }>`insert into task_comments (task_id, user_id, author_name, content)
      values (${taskId}, ${userId}, ${authorName}, ${content})
      returning
        id,
        task_id as "taskId",
        user_id as "userId",
        author_name as "authorName",
        content,
        created_at as "createdAt"`);
  const insertedRows = (Array.isArray((insertedResult as any)?.rows)
    ? (insertedResult as any).rows
    : Array.isArray(insertedResult)
      ? insertedResult
      : []) as Array<{
    id: number;
    taskId: number;
    userId: string;
    authorName: string;
    content: string;
    createdAt: Date | string;
  }>;
  const comment = insertedRows[0];
  if (!comment) {
    res.status(500).json({ error: "Errore creazione commento" });
    return;
  }

  res.status(201).json({
    ...comment,
    createdAt: new Date(comment.createdAt).toISOString(),
  });
});

router.get("/tasks/:id/activity", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    res.status(400).json({ error: "Task ID non valido" });
    return;
  }
  const access = await loadTaskIfAccessible(taskId, userId);
  if (!access.ok) { res.status(access.status).json({ error: access.status === 404 ? "Task not found" : "Accesso non autorizzato" }); return; }

  const rows = await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.entityType, "task"), eq(activityLog.entityId, taskId)))
    .orderBy(desc(activityLog.createdAt))
    .limit(50);

  res.json(rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  })));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), isNull(tasksTable.deletedAt)));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await userCanAccessTask(task, userId))) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }
  const enriched = await enrichTask(task);
  res.json(enriched);
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const parsedExtra = updateTaskExtraSchema.safeParse(req.body);
  if (!parsedExtra.success) {
    res.status(400).json({ error: parsedExtra.error.message });
    return;
  }
  const extra = parsedExtra.data;

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  const b = req.body as Record<string, unknown>;
  if (d.title != null) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.projectId !== undefined) updates.projectId = d.projectId;
  // Il cliente si può cambiare (o azzerare → task "Generale"). Prima il campo
  // veniva ignorato in PATCH: si poteva creare una task con cliente ma non
  // spostarla. Come in POST, se c'è un progetto vince il cliente del progetto.
  if (d.projectId != null) {
    const fromProject = await clientIdOfProject(d.projectId);
    if (fromProject != null) updates.clientId = fromProject;
    else if (extra.clientId !== undefined) updates.clientId = extra.clientId;
  } else if (extra.clientId !== undefined) {
    updates.clientId = extra.clientId;
  }
  if (d.assigneeId !== undefined) updates.assigneeId = d.assigneeId;
  if (d.status != null) {
    updates.status = d.status;
    // Timbra il completamento così "Completate oggi" (today.tsx) e i conteggi
    // funzionano. Prima solo daily-focus lo scriveva → sezione sempre vuota.
    updates.completedAt = d.status === "done" ? new Date() : null;
  }
  if (d.priority != null) updates.priority = d.priority;
  if (d.dueDate !== undefined) updates.dueDate = d.dueDate;
  if (b.tipo != null) updates.tipo = b.tipo;
  if (b.categoria !== undefined) updates.categoria = b.categoria;
  if (b.checklistJson != null) updates.checklistJson = b.checklistJson;
  if (b.pacchettoContenuti !== undefined) updates.pacchettoContenuti = b.pacchettoContenuti;
  if (b.meseRiferimento !== undefined) updates.meseRiferimento = b.meseRiferimento;

  const [ex] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), isNull(tasksTable.deletedAt)));
  if (!ex) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await userCanAccessTask(ex, userId))) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }
  // Il cliente di destinazione dev'essere anch'esso accessibile, altrimenti si
  // potrebbe "spingere" una task dentro il perimetro di un cliente non proprio.
  if (updates.clientId != null) {
    const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(updates.clientId as number)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
  }

  const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const enriched = await enrichTask(task);
  res.json(enriched);
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [ex] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), isNull(tasksTable.deletedAt)));
  if (!ex) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!(await userCanAccessTask(ex, userId))) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }
  const r = await softDeleteRecord("tasks", String(params.data.id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

export default router;
