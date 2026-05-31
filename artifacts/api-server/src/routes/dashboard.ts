import { Router, type IRouter } from "express";
import { db, clientsTable, projectsTable, tasksTable, teamMembersTable, messagesTable, filesTable, quoteTemplatesTable, contractTemplatesTable, clientEventsTable, clientReportsTable, clientPostsTable, contractsTable } from "@workspace/db";
import { desc, eq, isNull } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetProjectStatusBreakdownResponse,
} from "@workspace/api-zod";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";

const router: IRouter = Router();

// Tutti gli endpoint dashboard richiedono login. Path scopato a "/dashboard"
// per NON bloccare il traffico pass-through degli altri router.
router.use("/dashboard", (req, res, next) => {
  if (!getUserId(req)) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [clients, projects, tasks, members] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(projectsTable),
    db.select().from(tasksTable),
    db.select().from(teamMembersTable),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const pendingTasks = tasks.filter((t) => t.status !== "done").length;

  res.json(GetDashboardSummaryResponse.parse({
    totalClients: clients.length,
    totalProjects: projects.length,
    activeProjects,
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks,
    teamMembers: members.length,
  }));
});

// Calendario eventi UNIFICATO: tutti gli eventi dei clienti accessibili,
// indipendentemente dal cliente attivo (riepilogo dei prossimi eventi).
router.get("/dashboard/events", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId as string);

  const clients = await db
    .select({ id: clientsTable.id, name: clientsTable.name, brandColor: clientsTable.brandColor, color: clientsTable.color })
    .from(clientsTable)
    .where(isNull(clientsTable.deletedAt));
  const clientMap = new Map(clients.map((c) => [c.id, { name: c.name, color: c.brandColor ?? c.color ?? "#7a8f5c" }]));

  const rows = await db.select().from(clientEventsTable);
  const result = rows
    .filter((e) => clientMap.has(e.clientId) && (accessible === "all" || accessible.includes(e.clientId)))
    .map((e) => ({
      id: String(e.id),
      clientId: e.clientId,
      clientName: clientMap.get(e.clientId)?.name ?? null,
      clientColor: clientMap.get(e.clientId)?.color ?? "#7a8f5c",
      title: e.title,
      date: e.date.toISOString(),
      endDate: e.endDate ? e.endDate.toISOString() : null,
      type: e.type,
      priority: e.priority,
      note: e.note ?? null,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.json(result);
});

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const [projects, tasks, messages, files] = await Promise.all([
    db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt)).limit(5),
    db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt)).limit(5),
    db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(3),
    db.select().from(filesTable).orderBy(desc(filesTable.createdAt)).limit(3),
  ]);

  const activity: Array<{ id: number; type: string; description: string; entityName: string; createdAt: Date }> = [];

  for (const p of projects) {
    activity.push({ id: p.id * 10 + 1, type: "project", description: "Progetto creato", entityName: p.name, createdAt: p.createdAt });
  }
  for (const t of tasks) {
    activity.push({ id: t.id * 10 + 2, type: "task", description: `Task ${t.status}`, entityName: t.title, createdAt: t.createdAt });
  }
  for (const m of messages) {
    activity.push({ id: m.id * 10 + 3, type: "message", description: "Nuovo messaggio", entityName: m.authorName, createdAt: m.createdAt });
  }
  for (const f of files) {
    activity.push({ id: f.id * 10 + 4, type: "file", description: "File caricato", entityName: f.name, createdAt: f.createdAt });
  }

  activity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(GetRecentActivityResponse.parse(
    activity.slice(0, 15).map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))
  ));
});

router.get("/dashboard/project-status", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);
  const statusMap: Record<string, number> = {};
  for (const p of projects) {
    statusMap[p.status] = (statusMap[p.status] ?? 0) + 1;
  }
  const result = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
  res.json(GetProjectStatusBreakdownResponse.parse(result));
});

router.get("/dashboard/task-trends", async (_req, res): Promise<void> => {
  const tasks = await db.select().from(tasksTable);
  const months: Record<string, { total: number; done: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[key] = { total: 0, done: 0 };
  }
  for (const t of tasks) {
    const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (months[key]) {
      months[key].total++;
      if (t.status === "done") months[key].done++;
    }
  }
  const MONTH_NAMES = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const result = Object.entries(months).map(([key, v]) => {
    const month = parseInt(key.split("-")[1]) - 1;
    return { month: MONTH_NAMES[month], creati: v.total, completati: v.done };
  });
  res.json(result);
});

router.get("/dashboard/revenue", async (_req, res): Promise<void> => {
  const quotes = await db.select().from(quoteTemplatesTable);
  const contracts = await db.select().from(contractTemplatesTable);
  const totalQuotes = quotes.length;
  const approvedQuotes = quotes.filter((q) => q.status === "accettato").length;
  const activeContracts = contracts.filter((c) => c.status === "firmato").length;
  let totalRevenue = 0;
  for (const q of quotes.filter((q) => q.status === "accettato")) {
    const items = (Array.isArray(q.items) ? q.items : []) as Array<{ quantity: number; unitPrice: number }>;
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    totalRevenue += subtotal * (1 + q.taxRate / 100);
  }
  res.json({
    totalQuotes,
    approvedQuotes,
    activeContracts: activeContracts,
    totalContracts: contracts.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    conversionRate: totalQuotes > 0 ? Math.round((approvedQuotes / totalQuotes) * 100) : 0,
  });
});

/**
 * Coda unificata "in attesa di azione": aggrega editorial posts in approvazione,
 * report in revisione/approvati pronti per invio, e contratti in scadenza nei
 * prossimi 30 giorni. Serve al widget di approval-queue sulla dashboard.
 */
router.get("/dashboard/pending-approvals", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId as string);
  const isAccessible = (clientId: number) => accessible === "all" || accessible.includes(clientId);

  const [clients, posts, reports, contracts] = await Promise.all([
    db.select({ id: clientsTable.id, name: clientsTable.name, brandColor: clientsTable.brandColor, color: clientsTable.color }).from(clientsTable).where(isNull(clientsTable.deletedAt)),
    db.select().from(clientPostsTable),
    db.select().from(clientReportsTable),
    db.select().from(contractsTable).where(isNull(contractsTable.deletedAt)),
  ]);
  const clientMap = new Map(clients.map((c) => [c.id, { name: c.name, color: c.brandColor ?? c.color ?? "#7a8f5c" }]));

  const now = Date.now();
  const in30d = now + 30 * 86_400_000;

  type Item = {
    id: string;
    kind: "post_approval" | "report_review" | "report_send" | "contract_expiring";
    title: string;
    clientId: number;
    clientName: string;
    clientColor: string;
    dueAt: string | null;
    href: string;
    badge: string;
  };
  const items: Item[] = [];

  for (const p of posts) {
    if (p.status !== "pending_approval") continue;
    if (!isAccessible(p.clientId)) continue;
    const c = clientMap.get(p.clientId);
    if (!c) continue;
    items.push({
      id: `post-${p.id}`,
      kind: "post_approval",
      title: p.title,
      clientId: p.clientId,
      clientName: c.name,
      clientColor: c.color,
      dueAt: p.scheduledDate ? p.scheduledDate.toISOString() : null,
      href: "/tools/calendar",
      badge: "Post da approvare",
    });
  }

  for (const r of reports) {
    if (!isAccessible(r.clientId)) continue;
    const c = clientMap.get(r.clientId);
    if (!c) continue;
    if (r.status === "in_revisione") {
      items.push({
        id: `report-rev-${r.id}`,
        kind: "report_review",
        title: r.titolo || `Report ${r.periodLabel}`,
        clientId: r.clientId,
        clientName: c.name,
        clientColor: c.color,
        dueAt: r.scheduledFor ? r.scheduledFor.toISOString() : null,
        href: "/tools/reports",
        badge: "Report in revisione",
      });
    } else if (r.status === "approvato" && !r.sentAt) {
      items.push({
        id: `report-send-${r.id}`,
        kind: "report_send",
        title: r.titolo || `Report ${r.periodLabel}`,
        clientId: r.clientId,
        clientName: c.name,
        clientColor: c.color,
        dueAt: r.scheduledFor ? r.scheduledFor.toISOString() : null,
        href: "/tools/reports",
        badge: "Report da inviare",
      });
    }
  }

  for (const ct of contracts) {
    if (!isAccessible(ct.clientId)) continue;
    const c = clientMap.get(ct.clientId);
    if (!c) continue;
    if (!ct.dataFine) continue;
    const end = new Date(ct.dataFine).getTime();
    if (Number.isNaN(end)) continue;
    if (end < now || end > in30d) continue;
    items.push({
      id: `contract-${ct.id}`,
      kind: "contract_expiring",
      title: `${ct.oggetto} · ${ct.numero}`,
      clientId: ct.clientId,
      clientName: c.name,
      clientColor: c.color,
      dueAt: new Date(end).toISOString(),
      href: "/contracts/templates",
      badge: "Contratto in scadenza",
    });
  }

  items.sort((a, b) => {
    const ta = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  res.json({
    items,
    counts: {
      total: items.length,
      postApproval: items.filter((i) => i.kind === "post_approval").length,
      reportReview: items.filter((i) => i.kind === "report_review").length,
      reportSend: items.filter((i) => i.kind === "report_send").length,
      contractExpiring: items.filter((i) => i.kind === "contract_expiring").length,
    },
  });
});

router.get("/dashboard/team-stats", async (_req, res): Promise<void> => {
  const [members, tasks, projects] = await Promise.all([
    db.select().from(teamMembersTable),
    db.select().from(tasksTable),
    db.select().from(projectsTable),
  ]);

  const stats = members.map((m) => {
    const memberTasks = tasks.filter((t) => t.assigneeId === m.id);
    const completed = memberTasks.filter((t) => t.status === "done").length;
    const inProgress = memberTasks.filter((t) => t.status === "in-progress").length;
    const todo = memberTasks.filter((t) => t.status === "todo").length;

    const memberProjectIds = new Set(memberTasks.map((t) => t.projectId).filter(Boolean));
    const activeProjects = projects.filter(
      (p) => memberProjectIds.has(p.id) && p.status === "active"
    ).length;

    return {
      id: m.id,
      name: `${m.name} ${m.surname ?? ""}`.trim(),
      role: m.role,
      photoUrl: m.photoUrl,
      avatarColor: m.avatarColor,
      tasksCompleted: completed,
      tasksInProgress: inProgress,
      tasksTodo: todo,
      totalTasks: memberTasks.length,
      activeProjects,
    };
  });

  res.json(stats);
});

export default router;
