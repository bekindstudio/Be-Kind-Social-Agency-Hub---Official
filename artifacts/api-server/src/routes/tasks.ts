import { Router, type IRouter } from "express";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db, tasksTable, projectsTable, teamMembersTable } from "@workspace/db";
import {
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  ListTasksQueryParams,
} from "@workspace/api-zod";
import { getUserId } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";

const router: IRouter = Router();

async function getProjectsAndMembers() {
  const [projects, members] = await Promise.all([
    db.select().from(projectsTable).where(isNull(projectsTable.deletedAt)),
    db.select().from(teamMembersTable),
  ]);
  return {
    projects,
    projectMap: new Map(projects.map((p) => [p.id, p.name])),
    projectClientMap: new Map(projects.map((p) => [p.id, p.clientId ?? null])),
    memberMap: new Map(members.map((m) => [m.id, m.name])),
  };
}

function serializeTask(task: typeof tasksTable.$inferSelect, projectMap: Map<number, string>, memberMap: Map<number, string>) {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    projectName: task.projectId ? (projectMap.get(task.projectId) ?? null) : null,
    assigneeName: task.assigneeId ? (memberMap.get(task.assigneeId) ?? null) : null,
  };
}

async function enrichTask(task: typeof tasksTable.$inferSelect) {
  const { projectMap, memberMap } = await getProjectsAndMembers();
  return serializeTask(task, projectMap, memberMap);
}

async function seedAdvancedTasks() {
  const taskCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasksTable)
    .where(isNull(tasksTable.deletedAt));

  if (Number(taskCount[0]?.count) > 0) return;

  const members = await db.select().from(teamMembersTable).limit(2);
  const assigneeId = members[0]?.id ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const in7d = new Date(); in7d.setDate(in7d.getDate() + 7);
  const in14d = new Date(); in14d.setDate(in14d.getDate() + 14);
  const in30d = new Date(); in30d.setDate(in30d.getDate() + 30);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  const seeds = [
    {
      title: "Controllo commenti e DM Instagram",
      description: "Monitorare inbox e rispondere ai messaggi urgenti dei clienti",
      assigneeId,
      status: "todo",
      priority: "urgent",
      dueDate: yesterday.toISOString().slice(0, 10),
      tipo: "semplice",
      categoria: null,
      checklistJson: "[]",
      pacchettoContenuti: null,
      meseRiferimento: null,
    },
    {
      title: "Aggiornamento KPI settimanali dashboard cliente",
      description: "Aggiornare metriche principali nel report condiviso",
      assigneeId: members[1]?.id ?? assigneeId,
      status: "review",
      priority: "medium",
      dueDate: in7d.toISOString().slice(0, 10),
      tipo: "semplice",
      categoria: null,
      checklistJson: "[]",
      pacchettoContenuti: null,
      meseRiferimento: null,
    },
    {
      title: "Onboarding Cliente Nuovo",
      description: "Processo completo di onboarding per nuovo cliente",
      assigneeId,
      status: "in-progress",
      priority: "high",
      dueDate: in14d.toISOString().slice(0, 10),
      tipo: "avanzata",
      categoria: "Onboarding Nuovo Cliente",
      checklistJson: JSON.stringify([
        { id: "ob1", testo: "Analisi gratuita", completato: true, gruppo: "" },
        { id: "ob2", testo: "Meeting conoscitivo", completato: true, gruppo: "" },
        { id: "ob3", testo: "Preventivo con portfolio", completato: true, gruppo: "" },
        { id: "ob4", testo: "Contratto firmato", completato: true, gruppo: "" },
        { id: "ob5", testo: "Drive condiviso creato (template)", completato: false, gruppo: "" },
        { id: "ob6", testo: "Briefing con domande e obiettivi (Excel)", completato: false, gruppo: "" },
        { id: "ob7", testo: "Facebook - credenziali ricevute", completato: true, gruppo: "Credenziali ricevute o pagine create" },
        { id: "ob8", testo: "Instagram - credenziali ricevute", completato: true, gruppo: "Credenziali ricevute o pagine create" },
        { id: "ob9", testo: "LinkedIn - credenziali ricevute", completato: false, gruppo: "Credenziali ricevute o pagine create" },
        { id: "ob10", testo: "TikTok - credenziali ricevute", completato: false, gruppo: "Credenziali ricevute o pagine create" },
        { id: "ob11", testo: "YouTube - credenziali ricevute", completato: false, gruppo: "Credenziali ricevute o pagine create" },
        { id: "ob12", testo: "Sito Web - credenziali ricevute", completato: false, gruppo: "Credenziali ricevute o pagine create" },
        { id: "ob13", testo: "Brand Kit Canva creato", completato: false, gruppo: "" },
        { id: "ob14", testo: "Ricerca competitors completata", completato: false, gruppo: "" },
      ]),
      pacchettoContenuti: null,
      meseRiferimento: null,
    },
    {
      title: "Piano Editoriale Aprile",
      description: "Produzione contenuti mensili per il mese di Aprile",
      assigneeId,
      status: "review",
      priority: "medium",
      dueDate: in30d.toISOString().slice(0, 10),
      tipo: "avanzata",
      categoria: "Piano Editoriale Mensile",
      checklistJson: JSON.stringify([
        { id: "pe1", testo: "PED Aprile - Piano editoriale creato", completato: true, gruppo: "" },
        { id: "pe2", testo: "Template Carosello", completato: true, gruppo: "Template grafici creati" },
        { id: "pe3", testo: "Template Storia", completato: true, gruppo: "Template grafici creati" },
        { id: "pe4", testo: "Template Post IG", completato: false, gruppo: "Template grafici creati" },
        { id: "pe5", testo: "Contenuti Foto/Video creati (4 su 8)", completato: false, gruppo: "" },
        { id: "pe6", testo: "Contenuti grafici creati (0 su 8)", completato: false, gruppo: "" },
        { id: "pe7", testo: "Programmazione completata", completato: false, gruppo: "" },
        { id: "pe8", testo: "Pubblicazioni verificate", completato: false, gruppo: "" },
        { id: "pe9", testo: "Approvazione cliente ricevuta", completato: false, gruppo: "" },
      ]),
      pacchettoContenuti: "8",
      meseRiferimento: "Aprile",
    },
    {
      title: "Campagna ADV Meta – Brand Awareness Q2",
      description: "Configurazione e lancio campagna Meta Ads per Q2",
      assigneeId: members[1]?.id ?? assigneeId,
      status: "in-progress",
      priority: "high",
      dueDate: today,
      tipo: "avanzata",
      categoria: "Campagna ADV Meta",
      checklistJson: JSON.stringify([
        { id: "ma1", testo: "Strategia campagna definita", completato: true, gruppo: "" },
        { id: "ma2", testo: "Pubblici target creati (Tofu)", completato: true, gruppo: "" },
        { id: "ma3", testo: "Pubblici retargeting creati (Bofu)", completato: true, gruppo: "" },
        { id: "ma4", testo: "Creatività ads realizzate", completato: true, gruppo: "" },
        { id: "ma5", testo: "Copy ads scritto e approvato", completato: false, gruppo: "" },
        { id: "ma6", testo: "Campagna configurata su Meta Ads Manager", completato: false, gruppo: "" },
        { id: "ma7", testo: "Pixel eventi verificati", completato: false, gruppo: "" },
        { id: "ma8", testo: "Campagna attivata", completato: false, gruppo: "" },
        { id: "ma9", testo: "Primo check performance (dopo 48h)", completato: false, gruppo: "" },
        { id: "ma10", testo: "Ottimizzazione in corso", completato: false, gruppo: "" },
        { id: "ma11", testo: "Report risultati", completato: false, gruppo: "" },
      ]),
      pacchettoContenuti: null,
      meseRiferimento: null,
    },
    {
      title: "Campagna ADV Google - Lead Generation",
      description: "Preparazione campagna Search e brand protection",
      assigneeId,
      status: "done",
      priority: "high",
      dueDate: in14d.toISOString().slice(0, 10),
      tipo: "avanzata",
      categoria: "Campagna ADV Google",
      checklistJson: JSON.stringify([
        { id: "ga1", testo: "Ricerca e analisi parole chiave completata", completato: true, gruppo: "" },
        { id: "ga2", testo: "Struttura campagna definita", completato: true, gruppo: "" },
        { id: "ga3", testo: "Campagna principale creata", completato: true, gruppo: "" },
        { id: "ga4", testo: "Campagna brand creata", completato: true, gruppo: "" },
        { id: "ga5", testo: "Campagna competitors creata", completato: true, gruppo: "" },
        { id: "ga6", testo: "Annunci scritti e approvati", completato: true, gruppo: "" },
        { id: "ga7", testo: "Estensioni annunci configurate", completato: true, gruppo: "" },
        { id: "ga8", testo: "Conversioni tracciate con GTM", completato: true, gruppo: "" },
        { id: "ga9", testo: "Campagna attivata", completato: true, gruppo: "" },
        { id: "ga10", testo: "Check performance iniziale", completato: true, gruppo: "" },
        { id: "ga11", testo: "Report risultati", completato: true, gruppo: "" },
      ]),
      pacchettoContenuti: null,
      meseRiferimento: null,
    },
  ];

  for (const s of seeds) {
    await db.insert(tasksTable).values(s);
  }
}

router.get("/tasks", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const query = ListTasksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  await seedAdvancedTasks();

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(isNull(tasksTable.deletedAt))
    .orderBy(tasksTable.createdAt);
  const rawClientId = req.query.clientId;
  const clientId = rawClientId != null && rawClientId !== "" ? Number(rawClientId) : null;
  const { projectMap, projectClientMap, memberMap } = await getProjectsAndMembers();

  let result = tasks.map((t) => serializeTask(t, projectMap, memberMap));

  if (query.data.projectId != null) result = result.filter((t) => t.projectId === query.data.projectId);
  if (clientId != null && Number.isFinite(clientId)) {
    result = result.filter((t) => {
      if (t.projectId == null) return false;
      return projectClientMap.get(t.projectId) === clientId;
    });
  }
  if (query.data.assigneeId != null) result = result.filter((t) => t.assigneeId === query.data.assigneeId);
  if (query.data.status != null) result = result.filter((t) => t.status === query.data.status);

  res.json(result);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const b = req.body as Record<string, unknown>;
  const [task] = await db.insert(tasksTable).values({
    title: d.title,
    description: d.description ?? null,
    projectId: d.projectId ?? null,
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

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  const b = req.body as Record<string, unknown>;
  if (d.title != null) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.projectId !== undefined) updates.projectId = d.projectId;
  if (d.assigneeId !== undefined) updates.assigneeId = d.assigneeId;
  if (d.status != null) updates.status = d.status;
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
  const r = await softDeleteRecord("tasks", String(params.data.id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

export default router;
