import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, projectsTable, clientsTable, tasksTable, teamMembersTable, projectActivityTable, projectTemplatesTable, projectMembersTable, projectMilestonesTable, projectExpensesTable } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  ListProjectsQueryParams,
} from "@workspace/api-zod";
import { getUserId as getUid, isEnvAdmin, getAccessibleClientIds, filterByClientAccess } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return isEnvAdmin(userId);
}

function canViewProject(
  project: typeof projectsTable.$inferSelect,
  userId: string | null | undefined
): boolean {
  if (!project.isPrivate) return true;
  if (isAdmin(userId)) return true;
  if (userId && project.createdBy === userId) return true;
  return false;
}

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(value: Date | string | null | undefined): string {
  const d = coerceDate(value);
  return d ? d.toISOString() : new Date(0).toISOString();
}

function serializeProject(
  project: typeof projectsTable.$inferSelect,
  clientName: string | null,
  extra?: Record<string, unknown>,
) {
  return {
    ...project,
    createdAt: toIso(project.createdAt),
    updatedAt: toIso(project.updatedAt),
    clientName,
    typeJson: project.typeJson ?? "[]",
    budget: project.budget != null ? Number(project.budget) : null,
    budgetSpeso: project.budgetSpeso != null ? Number(project.budgetSpeso) : null,
    billingRate: project.billingRate != null ? Number(project.billingRate) : null,
    lastActivityAt: coerceDate(project.lastActivityAt)?.toISOString() ?? null,
    ...extra,
  };
}

function calcHealth(input: {
  status: string;
  overdueTasks: number;
  budget: number;
  spent: number;
  deadline: string | null;
  progress: number;
  lastActivityAt: Date | string | null;
}): "on-track" | "at-risk" | "delayed" | "completed" | "paused" {
  if (input.status === "completed") return "completed";
  if (input.status === "on-hold") return "paused";
  const now = new Date();
  const daysToDeadline = input.deadline ? Math.ceil((new Date(input.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
  const usagePct = input.budget > 0 ? (input.spent / input.budget) * 100 : 0;
  const last = coerceDate(input.lastActivityAt);
  const inactiveDays = last ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) : 999;
  if (input.overdueTasks > 3 || usagePct > 95 || (daysToDeadline < 0 && input.progress < 100)) return "delayed";
  if (input.overdueTasks >= 1 || (usagePct >= 80 && usagePct <= 95) || (daysToDeadline <= 7 && input.progress < 70) || inactiveDays >= 7) return "at-risk";
  return "on-track";
}

async function seedProjectTemplates() {
  const existing = await db.select().from(projectTemplatesTable);
  if (existing.length > 0) return;
  await db.insert(projectTemplatesTable).values([
    { name: "Social Media Management", type: "Social", isSystem: "true", description: "Template mensile social", structureJson: JSON.stringify({ phases: ["Strategia", "Produzione", "Pubblicazione", "Report"] }) },
    { name: "Campagna ADV Meta", type: "ADV Meta", isSystem: "true", description: "Template campagna Meta", structureJson: JSON.stringify({ phases: ["Brief", "Setup", "Launch", "Ottimizzazione"] }) },
    { name: "Campagna ADV Google", type: "ADV Google", isSystem: "true", description: "Template campagna Google", structureJson: JSON.stringify({ phases: ["Keyword", "Setup", "Launch", "Report"] }) },
    { name: "Lancio Prodotto", type: "Altro", isSystem: "true", description: "Template full campaign", structureJson: JSON.stringify({ phases: ["Teasing", "Lancio", "Follow-up"] }) },
    { name: "Restyling Brand Identity", type: "Branding", isSystem: "true", description: "Template branding", structureJson: JSON.stringify({ phases: ["Audit", "Concept", "Execution", "Delivery"] }) },
    { name: "Sito Web", type: "Web", isSystem: "true", description: "Template web", structureJson: JSON.stringify({ phases: ["UX", "Design", "Dev", "QA", "Go-live"] }) },
  ]);
}

async function seedProjectsIfEmpty() {
  const count = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt));
  if (count.length > 0) return;
  await seedProjectTemplates();

  const clients = await db.select().from(clientsTable);
  const members = await db.select().from(teamMembersTable).limit(4);
  if (clients.length === 0) return;
  const fiore = clients.find((c) => c.name.includes("Fiore")) ?? clients[0];
  const tech = clients.find((c) => c.name.includes("TechNova")) ?? clients[0];
  const rossi = clients.find((c) => c.name.includes("Rossi")) ?? clients[0];
  const now = new Date();
  const d30 = new Date(); d30.setDate(now.getDate() + 30);
  const d10 = new Date(); d10.setDate(now.getDate() + 10);
  const dm5 = new Date(); dm5.setDate(now.getDate() - 5);
  const d15 = new Date(); d15.setDate(now.getDate() + 15);

  const [p1, p2, p3, p4] = await db.insert(projectsTable).values([
    { clientId: fiore.id, name: "Campagna Social Spring 2025", description: "Piano editoriale stagionale e produzione contenuti", typeJson: JSON.stringify(["Social Media"]), status: "active", healthStatus: "on-track", progress: 67, budget: "5000", budgetSpeso: "3200", deadline: d30.toISOString().slice(0, 10), color: "#d946ef", oreStimate: 80, oreLavorate: 48, paymentStructure: "Mensile ricorrente" },
    { clientId: tech.id, name: "Lancio TechNova X1", description: "Campagna multi-canale performance", typeJson: JSON.stringify(["ADV Meta", "ADV Google"]), status: "active", healthStatus: "at-risk", progress: 38, budget: "22000", budgetSpeso: "18500", deadline: d10.toISOString().slice(0, 10), color: "#3b82f6", oreStimate: 160, oreLavorate: 120, paymentStructure: "A milestone" },
    { clientId: rossi.id, name: "Restyling Brand Identity", description: "Nuova identità visiva completa", typeJson: JSON.stringify(["Branding"]), status: "on-hold", healthStatus: "delayed", progress: 40, budget: "5000", budgetSpeso: "2800", deadline: dm5.toISOString().slice(0, 10), color: "#f97316", oreStimate: 90, oreLavorate: 52, paymentStructure: "Una tantum" },
    { clientId: fiore.id, name: "Newsletter Mensile Aprile", description: "Piano newsletter e automazioni", typeJson: JSON.stringify(["Email Marketing"]), status: "active", healthStatus: "on-track", progress: 30, budget: "800", budgetSpeso: "400", deadline: d15.toISOString().slice(0, 10), color: "#d946ef", oreStimate: 16, oreLavorate: 7, paymentStructure: "Mensile ricorrente", isRecurring: true, recurrenceType: "monthly" },
  ]).returning();

  try {
    const mid = members[0]?.id;
    for (const p of [p1, p2, p3, p4]) {
      if (mid) await db.insert(projectMembersTable).values({ projectId: p.id, userId: mid, role: "Project Manager" });
      await db.insert(projectMilestonesTable).values({ projectId: p.id, name: "Kickoff", description: "Avvio progetto", dueDate: new Date().toISOString().slice(0, 10), status: "achieved", linkedTasksJson: "[]" });
      await db.insert(projectActivityTable).values({ projectId: p.id, action: "Project created", detailsJson: JSON.stringify({ seed: true }) });
    }

    await db.insert(tasksTable).values([
      { projectId: p1.id, title: "Calendario contenuti approvato", status: "done", priority: "high" },
      { projectId: p1.id, title: "Produzione reels settimana 1", status: "done", priority: "medium" },
      { projectId: p1.id, title: "Copy carosello promozionale", status: "done", priority: "medium" },
      { projectId: p1.id, title: "Programmazione contenuti", status: "done", priority: "high" },
      { projectId: p1.id, title: "Report metà mese", status: "in-progress", priority: "medium" },
      { projectId: p1.id, title: "Ottimizzazione CTA", status: "in-progress", priority: "high" },
      { projectId: p2.id, title: "Setup campaign structure", status: "done", priority: "high" },
      { projectId: p2.id, title: "Pixel QA", status: "done", priority: "urgent" },
      { projectId: p2.id, title: "Creative set A/B", status: "done", priority: "high" },
      { projectId: p2.id, title: "Launch wave 1", status: "in-progress", priority: "urgent" },
      { projectId: p2.id, title: "Google Search ad group", status: "in-progress", priority: "high" },
      { projectId: p2.id, title: "Fix conversion API", status: "todo", priority: "urgent", dueDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) },
      { projectId: p2.id, title: "Retargeting audience sync", status: "todo", priority: "high", dueDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10) },
      { projectId: p2.id, title: "Budget pacing review", status: "todo", priority: "medium", dueDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10) },
    ]);
  } catch (err) {
    logger.warn(
      { err },
      "seedProjectsIfEmpty: righe collegate (members/milestones/activity/tasks) non inserite — verifica migrazione 20260410190000_satellite_tables_and_fks.sql",
    );
  }
}

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  try {
    await seedProjectsIfEmpty();

    const userId = getUid(req);

    const projects = await db
      .select()
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(projectsTable.createdAt);
    const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));

    const accessible = userId ? await getAccessibleClientIds(userId) : ("all" as const);
    const accessFiltered = filterByClientAccess(projects, accessible);

    const allTasks = await db.select().from(tasksTable).where(isNull(tasksTable.deletedAt));
    let result = accessFiltered
      .filter((p) => canViewProject(p, userId))
      .map((p) => {
        const projectTasks = allTasks.filter((t) => t.projectId === p.id);
        const done = projectTasks.filter((t) => t.status === "done").length;
        const total = projectTasks.length;
        const computedProgress = total > 0 ? Math.round((done / total) * 100) : (p.progress ?? 0);
        const overdue = projectTasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length;
        const health = calcHealth({
          status: p.status,
          overdueTasks: overdue,
          budget: Number(p.budget ?? 0),
          spent: Number(p.budgetSpeso ?? 0),
          deadline: p.deadline ?? p.endDate ?? null,
          progress: computedProgress,
          lastActivityAt: p.lastActivityAt ?? p.updatedAt ?? null,
        });
        return serializeProject(p, p.clientId ? (clientMap.get(p.clientId) ?? null) : null, {
          progress: computedProgress,
          healthStatus: health,
          tasksTotal: total,
          tasksDone: done,
        });
      });

    if (query.data.clientId != null) {
      result = result.filter((p) => p.clientId === query.data.clientId);
    }
    if (query.data.status != null) {
      result = result.filter((p) => p.status === query.data.status);
    }

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "GET /projects failed");
    if (msg.includes("deleted_at") || msg.includes("deletedAt")) {
      res.status(503).json({
        error: "Schema database non aggiornato",
        hint: "Aggiungi le colonne soft-delete (deleted_at) su projects, tasks, clients, ecc.: esegui supabase/migrations/20260410210000_soft_delete_trash_log.sql sul DB oppure dalla root `pnpm run db:push`.",
      });
      return;
    }
    res.status(500).json({ error: "Errore caricamento progetti", detail: msg });
  }
});

router.post("/projects", async (req, res): Promise<void> => {
  const body = req.body as any;
  if (!body?.name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  const userId = getUid(req);

  const [project] = await db.insert(projectsTable).values({
    name: body.name,
    description: body.description ?? null,
    clientId: body.clientId ?? null,
    status: body.status ?? "planning",
    progress: Number(body.progress ?? 0),
    deadline: body.deadline ?? null,
    budget: body.budget != null ? String(body.budget) : null,
    budgetSpeso: body.budgetSpeso != null ? String(body.budgetSpeso) : "0",
    category: body.category ?? null,
    color: body.color ?? null,
    typeJson: JSON.stringify(Array.isArray(body.projectTypes) ? body.projectTypes : Array.isArray(body.typeJson) ? body.typeJson : []),
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? body.deadline ?? null,
    oreStimate: body.oreStimate ?? null,
    paymentStructure: body.paymentStructure ?? null,
    billingRate: body.billingRate != null ? String(body.billingRate) : null,
    isRecurring: Boolean(body.isRecurring),
    recurrenceType: body.recurrenceType ?? null,
    templateId: body.templateId ?? null,
    notes: body.notes ?? null,
    createdBy: userId,
  }).returning();

  if (body.projectManagerId) {
    await db.insert(projectMembersTable).values({ projectId: project.id, userId: Number(body.projectManagerId), role: "Project Manager" });
  }
  if (Array.isArray(body.members)) {
    for (const m of body.members) {
      if (!m?.userId) continue;
      await db.insert(projectMembersTable).values({ projectId: project.id, userId: Number(m.userId), role: String(m.role ?? "Altro") });
    }
  }
  if (body.autoCreateOnboardingTask) {
    await db.insert(tasksTable).values({
      projectId: project.id,
      clientId: project.clientId ?? null,
      title: `Onboarding progetto - ${project.name}`,
      description: "Checklist setup rapido progetto",
      status: "todo",
      priority: "high",
      tipo: "avanzata",
      categoria: "Personalizzata",
      checklistJson: JSON.stringify([
        { id: "pob1", testo: "Kickoff meeting", completato: false, gruppo: "" },
        { id: "pob2", testo: "Allineamento obiettivi", completato: false, gruppo: "" },
        { id: "pob3", testo: "Setup strumenti", completato: false, gruppo: "" },
      ]),
    });
  }
  await db.insert(projectActivityTable).values({ projectId: project.id, userId, action: "Project created", detailsJson: JSON.stringify({ source: "modal" }) });

  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  res.status(201).json(
    serializeProject(project, project.clientId ? (clientMap.get(project.clientId) ?? null) : null)
  );
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getUid(req);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), isNull(projectsTable.deletedAt)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!canViewProject(project, userId)) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }

  if (userId && project.clientId) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(project.clientId)) {
      res.status(403).json({ error: "Accesso negato a questo progetto" });
      return;
    }
  }

  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  res.json(serializeProject(project, project.clientId ? (clientMap.get(project.clientId) ?? null) : null));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getUid(req);

  // Fetch existing project to check access
  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), isNull(projectsTable.deletedAt)));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!canViewProject(existing, userId)) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const body = req.body as any;
  if (body.name != null) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.clientId !== undefined) updates.clientId = body.clientId;
  if (body.status != null) updates.status = body.status;
  if (body.progress != null) updates.progress = body.progress;
  if (body.deadline !== undefined) updates.deadline = body.deadline;
  if (body.budget !== undefined) updates.budget = body.budget != null ? String(body.budget) : null;
  if (body.budgetSpeso !== undefined) updates.budgetSpeso = body.budgetSpeso != null ? String(body.budgetSpeso) : null;
  if (body.typeJson !== undefined) updates.typeJson = JSON.stringify(body.typeJson);
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.endDate !== undefined) updates.endDate = body.endDate;
  if (body.oreStimate !== undefined) updates.oreStimate = body.oreStimate;
  if (body.oreLavorate !== undefined) updates.oreLavorate = body.oreLavorate;
  if (body.paymentStructure !== undefined) updates.paymentStructure = body.paymentStructure;
  if (body.billingRate !== undefined) updates.billingRate = body.billingRate != null ? String(body.billingRate) : null;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.lastActivityAt !== undefined) updates.lastActivityAt = body.lastActivityAt ? new Date(body.lastActivityAt) : null;
  if (body.healthStatus !== undefined) updates.healthStatus = body.healthStatus;
  if ((req.body as any).category !== undefined) updates.category = (req.body as any).category;
  // Only admin or creator can toggle isPrivate
  if (body.isPrivate !== undefined && body.isPrivate !== null) {
    if (isAdmin(userId) || existing.createdBy === userId) {
      updates.isPrivate = body.isPrivate;
    }
  }

  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  await db.insert(projectActivityTable).values({ projectId: params.data.id, userId, action: "Project updated", detailsJson: JSON.stringify({ keys: Object.keys(updates) }) });
  res.json(serializeProject(project, project.clientId ? (clientMap.get(project.clientId) ?? null) : null));
});

router.post("/projects/:id/archive", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const userId = getUid(req);
  const [project] = await db
    .update(projectsTable)
    .set({ status: "archived" })
    .where(and(eq(projectsTable.id, params.data.id), isNull(projectsTable.deletedAt)))
    .returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  await db.insert(projectActivityTable).values({ projectId: project.id, userId, action: "Project archived", detailsJson: "{}" });
  res.json({ ok: true });
});

router.post("/projects/:id/duplicate", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { copyTasks = true, clientId = null, startDate = null, endDate = null } = (req.body ?? {}) as any;
  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), isNull(projectsTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }
  const [dup] = await db.insert(projectsTable).values({
    ...existing,
    id: undefined as any,
    name: `${existing.name} (Copia)`,
    status: "planning",
    progress: 0,
    clientId: clientId ?? existing.clientId,
    startDate: startDate ?? existing.startDate,
    endDate: endDate ?? existing.endDate,
    deadline: endDate ?? existing.deadline,
    createdAt: undefined as any,
    updatedAt: undefined as any,
  }).returning();
  if (copyTasks) {
    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, existing.id), isNull(tasksTable.deletedAt)));
    for (const t of tasks) {
      await db.insert(tasksTable).values({
        ...t,
        id: undefined as any,
        projectId: dup.id,
        status: "todo",
        createdAt: undefined as any,
        updatedAt: undefined as any,
      });
    }
  }
  res.status(201).json(dup);
});

router.get("/project-templates", async (_req, res): Promise<void> => {
  await seedProjectTemplates();
  const rows = await db.select().from(projectTemplatesTable);
  res.json(rows.map((r) => ({ ...r, structure: (() => { try { return JSON.parse(r.structureJson ?? "{}"); } catch { return {}; } })() })));
});

router.get("/projects/:id/workspace", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), isNull(projectsTable.deletedAt)));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [tasks, members, milestones, expenses, activity, templates, clients] = await Promise.all([
    db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, project.id), isNull(tasksTable.deletedAt))),
    db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, project.id)),
    db.select().from(projectMilestonesTable).where(eq(projectMilestonesTable.projectId, project.id)),
    db.select().from(projectExpensesTable).where(eq(projectExpensesTable.projectId, project.id)),
    db.select().from(projectActivityTable).where(eq(projectActivityTable.projectId, project.id)),
    db.select().from(projectTemplatesTable),
    db.select().from(clientsTable).where(isNull(clientsTable.deletedAt)),
  ]);
  const client = clients.find((c) => c.id === project.clientId) ?? null;
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const tasksTotal = tasks.length;
  const progress = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : project.progress;
  const spent = Number(project.budgetSpeso ?? 0) + expenses.reduce((acc, e) => acc + Number(e.amount ?? 0), 0);
  const budget = Number(project.budget ?? 0);
  const health = calcHealth({
    status: project.status,
    overdueTasks: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length,
    budget,
    spent,
    deadline: project.deadline ?? project.endDate ?? null,
    progress,
    lastActivityAt: project.lastActivityAt ?? project.updatedAt ?? null,
  });
  res.json({
    project: serializeProject(project, client?.name ?? null, { progress, healthStatus: health }),
    client,
    tasks,
    members,
    milestones,
    expenses,
    activity: activity.slice(0, 50),
    templates,
    stats: {
      tasksDone, tasksTotal, progress,
      budget, spent, budgetPct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    },
  });
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getUid(req);

  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), isNull(projectsTable.deletedAt)));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!canViewProject(existing, userId)) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }

  const r = await softDeleteRecord("projects", String(params.data.id), { deletedBy: userId });
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

export default router;
