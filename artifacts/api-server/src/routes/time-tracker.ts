import { Router, type IRouter } from "express";
import { eq, and, sql, desc, asc, gte, lte } from "drizzle-orm";
import {
  db,
  timeEntriesTable,
  timerSessionsTable,
  timesheetsTable,
  billingRatesTable,
  clientsTable,
  projectsTable,
  tasksTable,
  teamMembersTable,
} from "@workspace/db";
import { getUserId, isEnvAdmin, isAnonymousApiUserId } from "../lib/access-control";

const router: IRouter = Router();

async function enrichSession(session: any) {
  let clientName = null;
  let projectName = null;
  let taskTitle = null;
  if (session.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, session.clientId));
    clientName = c?.name ?? null;
  }
  if (session.projectId) {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, session.projectId));
    projectName = p?.name ?? null;
  }
  if (session.taskId) {
    const [t] = await db.select().from(tasksTable).where(eq(tasksTable.id, session.taskId));
    taskTitle = t?.title ?? null;
  }
  return {
    ...session,
    startedAt: session.startedAt?.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    resumedAt: session.resumedAt?.toISOString() ?? null,
    createdAt: session.createdAt?.toISOString(),
    clientName,
    projectName,
    taskTitle,
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function monthStartStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

router.get("/timer/active", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  // Con API_AUTH_DISABLED l'ID sintetico non è un UUID: evita query che falliscono se user_id nel DB è uuid.
  if (isAnonymousApiUserId(userId)) {
    res.json(null);
    return;
  }

  const [session] = await db.select().from(timerSessionsTable)
    .where(and(
      eq(timerSessionsTable.userId, userId),
      sql`${timerSessionsTable.status} IN ('running', 'paused')`
    ))
    .orderBy(desc(timerSessionsTable.startedAt))
    .limit(1);

  if (!session) { res.json(null); return; }
  res.json(await enrichSession(session));
});

router.get("/timer/active-all", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  if (isAnonymousApiUserId(userId)) {
    res.json([]);
    return;
  }

  const sessions = await db.select().from(timerSessionsTable)
    .where(and(
      eq(timerSessionsTable.userId, userId),
      sql`${timerSessionsTable.status} IN ('running', 'paused')`
    ))
    .orderBy(desc(timerSessionsTable.startedAt));

  const enriched = await Promise.all(sessions.map((session) => enrichSession(session)));
  res.json(enriched);
});

router.post("/timer/start", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const { clientId, projectId, taskId, description, activityType } = req.body;

  const [session] = await db.insert(timerSessionsTable).values({
    userId,
    clientId: clientId ? Number(clientId) : null,
    projectId: projectId ? Number(projectId) : null,
    taskId: taskId ? Number(taskId) : null,
    description: description ?? null,
    activityType: activityType ?? null,
    status: "running",
  }).returning();

  if (taskId) {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, Number(taskId)));
    if (task) {
      await db.update(tasksTable).set({ status: "in-progress" }).where(eq(tasksTable.id, Number(taskId)));
    }
  }

  res.status(201).json({
    ...session,
    startedAt: session.startedAt?.toISOString(),
    createdAt: session.createdAt?.toISOString(),
  });
});

router.post("/timer/pause", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const rawSessionId = req.body?.sessionId;
  const sessionId = rawSessionId != null ? Number(rawSessionId) : null;
  const baseConditions = [
    eq(timerSessionsTable.userId, userId),
    eq(timerSessionsTable.status, "running"),
  ];
  if (sessionId != null && Number.isFinite(sessionId)) {
    baseConditions.push(eq(timerSessionsTable.id, sessionId));
  }
  const [session] = await db.select().from(timerSessionsTable)
    .where(and(...baseConditions))
    .orderBy(desc(timerSessionsTable.startedAt))
    .limit(1);

  if (!session) { res.status(404).json({ error: "Nessun timer attivo" }); return; }

  const [updated] = await db.update(timerSessionsTable)
    .set({ status: "paused", pausedAt: new Date() })
    .where(eq(timerSessionsTable.id, session.id))
    .returning();

  res.json({ ...updated, startedAt: updated.startedAt?.toISOString(), pausedAt: updated.pausedAt?.toISOString() });
});

router.post("/timer/resume", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const rawSessionId = req.body?.sessionId;
  const sessionId = rawSessionId != null ? Number(rawSessionId) : null;
  const baseConditions = [
    eq(timerSessionsTable.userId, userId),
    eq(timerSessionsTable.status, "paused"),
  ];
  if (sessionId != null && Number.isFinite(sessionId)) {
    baseConditions.push(eq(timerSessionsTable.id, sessionId));
  }
  const [session] = await db.select().from(timerSessionsTable)
    .where(and(...baseConditions))
    .orderBy(desc(timerSessionsTable.startedAt))
    .limit(1);

  if (!session) { res.status(404).json({ error: "Nessun timer in pausa" }); return; }

  let additionalPaused = 0;
  if (session.pausedAt) {
    additionalPaused = Math.floor((Date.now() - session.pausedAt.getTime()) / 1000);
  }

  const [updated] = await db.update(timerSessionsTable)
    .set({
      status: "running",
      resumedAt: new Date(),
      pausedAt: null,
      totalPausedSeconds: (session.totalPausedSeconds ?? 0) + additionalPaused,
    })
    .where(eq(timerSessionsTable.id, session.id))
    .returning();

  res.json({ ...updated, startedAt: updated.startedAt?.toISOString(), resumedAt: updated.resumedAt?.toISOString() });
});

router.post("/timer/stop", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const { description, activityType, isBillable, discard, sessionId: rawSessionId } = req.body;
  const sessionId = rawSessionId != null ? Number(rawSessionId) : null;
  const baseConditions = [
    eq(timerSessionsTable.userId, userId),
    sql`${timerSessionsTable.status} IN ('running', 'paused')`,
  ];
  if (sessionId != null && Number.isFinite(sessionId)) {
    baseConditions.push(eq(timerSessionsTable.id, sessionId));
  }

  const [session] = await db.select().from(timerSessionsTable)
    .where(and(...baseConditions))
    .orderBy(desc(timerSessionsTable.startedAt))
    .limit(1);

  if (!session) { res.status(404).json({ error: "Nessun timer attivo" }); return; }

  let totalPaused = session.totalPausedSeconds ?? 0;
  if (session.status === "paused" && session.pausedAt) {
    totalPaused += Math.floor((Date.now() - session.pausedAt.getTime()) / 1000);
  }

  const endedAt = new Date();
  const totalSeconds = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);
  const durationSeconds = Math.max(0, totalSeconds - totalPaused);

  await db.update(timerSessionsTable)
    .set({ status: "stopped" })
    .where(eq(timerSessionsTable.id, session.id));

  if (discard) {
    res.json({ discarded: true });
    return;
  }

  const billable = isBillable !== undefined ? isBillable : true;
  const nonBillableTypes = ["riunione interna", "amministrazione"];
  const finalBillable = activityType && nonBillableTypes.includes(activityType.toLowerCase())
    ? false
    : billable;

  const [entry] = await db.insert(timeEntriesTable).values({
    userId,
    clientId: session.clientId,
    projectId: session.projectId,
    taskId: session.taskId,
    description: description ?? session.description ?? null,
    activityType: activityType ?? session.activityType ?? null,
    startedAt: session.startedAt,
    endedAt,
    pausedSeconds: totalPaused,
    durationSeconds,
    isBillable: finalBillable,
    isManual: false,
  }).returning();

  res.json({
    ...entry,
    startedAt: entry.startedAt?.toISOString(),
    endedAt: entry.endedAt?.toISOString(),
    createdAt: entry.createdAt?.toISOString(),
    updatedAt: entry.updatedAt?.toISOString(),
  });
});

router.post("/timer/force-stop", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const rawSessionId = req.body?.sessionId;
  const sessionId = rawSessionId != null ? Number(rawSessionId) : null;
  const baseConditions = [
    eq(timerSessionsTable.userId, userId),
    sql`${timerSessionsTable.status} IN ('running', 'paused')`,
  ];
  if (sessionId != null && Number.isFinite(sessionId)) {
    baseConditions.push(eq(timerSessionsTable.id, sessionId));
  }

  await db.update(timerSessionsTable)
    .set({ status: "stopped" })
    .where(and(...baseConditions));

  res.json({ success: true });
});

router.get("/time-entries", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const { clientId, projectId, from, to } = req.query as Record<string, string | undefined>;
  const conditions: any[] = [eq(timeEntriesTable.userId, userId)];

  if (clientId) conditions.push(eq(timeEntriesTable.clientId, Number(clientId)));
  if (projectId) conditions.push(eq(timeEntriesTable.projectId, Number(projectId)));
  if (from) conditions.push(gte(timeEntriesTable.startedAt, new Date(from)));
  if (to) conditions.push(lte(timeEntriesTable.startedAt, new Date(to)));

  const entries = await db.select().from(timeEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(timeEntriesTable.startedAt));

  const [clients, projects, tasks] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(projectsTable),
    db.select().from(tasksTable),
  ]);
  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const projectMap = new Map(projects.map(p => [p.id, p.name]));
  const taskMap = new Map(tasks.map(t => [t.id, t.title]));

  res.json(entries.map(e => ({
    ...e,
    startedAt: e.startedAt?.toISOString(),
    endedAt: e.endedAt?.toISOString(),
    createdAt: e.createdAt?.toISOString(),
    updatedAt: e.updatedAt?.toISOString(),
    clientName: e.clientId ? clientMap.get(e.clientId) ?? null : null,
    projectName: e.projectId ? projectMap.get(e.projectId) ?? null : null,
    taskTitle: e.taskId ? taskMap.get(e.taskId) ?? null : null,
  })));
});

router.post("/time-entries", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const { clientId, projectId, taskId, description, activityType, startedAt, endedAt, durationSeconds, isBillable } = req.body;

  if (!clientId) {
    res.status(400).json({ error: "clientId obbligatorio" }); return;
  }

  let start: Date;
  let end: Date;
  let duration: number;

  if (durationSeconds) {
    duration = Number(durationSeconds);
    start = startedAt ? new Date(startedAt) : new Date();
    end = new Date(start.getTime() + duration * 1000);
  } else if (startedAt && endedAt) {
    start = new Date(startedAt);
    end = new Date(endedAt);
    duration = Math.floor((end.getTime() - start.getTime()) / 1000);
  } else {
    res.status(400).json({ error: "Specificare durationSeconds oppure startedAt+endedAt" }); return;
  }

  const [entry] = await db.insert(timeEntriesTable).values({
    userId,
    clientId: Number(clientId),
    projectId: projectId ? Number(projectId) : null,
    taskId: taskId ? Number(taskId) : null,
    description: description ?? null,
    activityType: activityType ?? null,
    startedAt: start,
    endedAt: end,
    durationSeconds: duration,
    isBillable: isBillable !== undefined ? isBillable : true,
    isManual: true,
  }).returning();

  res.status(201).json({
    ...entry,
    startedAt: entry.startedAt?.toISOString(),
    endedAt: entry.endedAt?.toISOString(),
    createdAt: entry.createdAt?.toISOString(),
    updatedAt: entry.updatedAt?.toISOString(),
  });
});

router.patch("/time-entries/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db.select().from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.id, id), eq(timeEntriesTable.userId, userId)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Entry non trovata" }); return; }

  const updates: Record<string, unknown> = {};
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.activityType !== undefined) updates.activityType = req.body.activityType;
  if (req.body.isBillable !== undefined) updates.isBillable = Boolean(req.body.isBillable);
  if (req.body.clientId !== undefined) updates.clientId = req.body.clientId ? Number(req.body.clientId) : null;
  if (req.body.projectId !== undefined) updates.projectId = req.body.projectId ? Number(req.body.projectId) : null;
  if (req.body.taskId !== undefined) updates.taskId = req.body.taskId ? Number(req.body.taskId) : null;
  if (req.body.durationSeconds !== undefined) {
    const duration = Number(req.body.durationSeconds);
    if (!Number.isFinite(duration) || duration < 0) {
      res.status(400).json({ error: "durationSeconds non valido" });
      return;
    }
    updates.durationSeconds = Math.floor(duration);
    updates.endedAt = new Date(existing.startedAt.getTime() + Math.floor(duration) * 1000);
  }

  const [updated] = await db.update(timeEntriesTable).set(updates)
    .where(and(eq(timeEntriesTable.id, id), eq(timeEntriesTable.userId, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Entry non trovata" }); return; }
  res.json({
    ...updated,
    startedAt: updated.startedAt?.toISOString(),
    endedAt: updated.endedAt?.toISOString(),
    createdAt: updated.createdAt?.toISOString(),
    updatedAt: updated.updatedAt?.toISOString(),
  });
});

router.delete("/time-entries/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  await db.delete(timeEntriesTable)
    .where(and(eq(timeEntriesTable.id, id), eq(timeEntriesTable.userId, userId)));
  res.status(204).end();
});

router.get("/time-tracker/stats", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const rawClientId = req.query.clientId;
  const clientId = rawClientId != null && rawClientId !== "" ? Number(rawClientId) : null;
  if (rawClientId != null && rawClientId !== "" && !Number.isFinite(clientId)) {
    res.status(400).json({ error: "clientId non valido" });
    return;
  }

  const today = todayStr();
  const weekStart = weekStartStr();
  const monthStart = monthStartStr();

  const rangeStart = weekStart < monthStart ? weekStart : monthStart;
  const statConditions = [
    eq(timeEntriesTable.userId, userId),
    gte(timeEntriesTable.startedAt, new Date(rangeStart)),
  ];
  if (clientId != null) {
    statConditions.push(eq(timeEntriesTable.clientId, clientId));
  }
  const allEntries = await db.select().from(timeEntriesTable)
    .where(and(...statConditions))
    .orderBy(desc(timeEntriesTable.startedAt));

  const todayEntries = allEntries.filter(e => e.startedAt.toISOString().slice(0, 10) === today);
  const weekEntries = allEntries.filter(e => e.startedAt.toISOString().slice(0, 10) >= weekStart);
  const monthEntries = allEntries.filter(e => e.startedAt.toISOString().slice(0, 10) >= monthStart);

  const sumDuration = (entries: typeof allEntries) => entries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const sumBillable = (entries: typeof allEntries) => entries.filter(e => e.isBillable).reduce((s, e) => s + (e.durationSeconds ?? 0), 0);

  const [clients, projects] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(projectsTable),
  ]);
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const projectMap = new Map(projects.map(p => [p.id, p]));

  const clientBreakdown: Record<number, { name: string; color: string | null; seconds: number; billable: number }> = {};
  const projectBreakdown: Record<number, { name: string; clientName: string | null; seconds: number; billable: number }> = {};

  for (const entry of monthEntries) {
    if (entry.clientId) {
      if (!clientBreakdown[entry.clientId]) {
        const c = clientMap.get(entry.clientId);
        clientBreakdown[entry.clientId] = { name: c?.name ?? "?", color: c?.color ?? null, seconds: 0, billable: 0 };
      }
      clientBreakdown[entry.clientId].seconds += entry.durationSeconds ?? 0;
      if (entry.isBillable) clientBreakdown[entry.clientId].billable += entry.durationSeconds ?? 0;
    }
    if (entry.projectId) {
      if (!projectBreakdown[entry.projectId]) {
        const p = projectMap.get(entry.projectId);
        const c = p?.clientId ? clientMap.get(p.clientId) : null;
        projectBreakdown[entry.projectId] = { name: p?.name ?? "?", clientName: c?.name ?? null, seconds: 0, billable: 0 };
      }
      projectBreakdown[entry.projectId].seconds += entry.durationSeconds ?? 0;
      if (entry.isBillable) projectBreakdown[entry.projectId].billable += entry.durationSeconds ?? 0;
    }
  }

  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const weeklyChart = dayNames.map((name, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayEntries = weekEntries.filter(e => e.startedAt.toISOString().slice(0, 10) === dateStr);
    return {
      day: name,
      date: dateStr,
      seconds: sumDuration(dayEntries),
      billable: sumBillable(dayEntries),
    };
  });

  const todayTimeline = todayEntries.map(e => ({
    id: e.id,
    clientId: e.clientId,
    clientName: e.clientId ? clientMap.get(e.clientId)?.name ?? null : null,
    clientColor: e.clientId ? clientMap.get(e.clientId)?.color ?? null : null,
    description: e.description,
    startedAt: e.startedAt.toISOString(),
    endedAt: e.endedAt?.toISOString() ?? null,
    durationSeconds: e.durationSeconds,
    activityType: e.activityType,
    isBillable: e.isBillable,
  }));

  res.json({
    today: sumDuration(todayEntries),
    thisWeek: sumDuration(weekEntries),
    thisMonth: sumDuration(monthEntries),
    billableMonth: sumBillable(monthEntries),
    totalMonth: sumDuration(monthEntries),
    weeklyChart,
    todayTimeline,
    clientBreakdown: Object.entries(clientBreakdown)
      .map(([id, v]) => ({ clientId: Number(id), ...v }))
      .sort((a, b) => b.seconds - a.seconds),
    projectBreakdown: Object.entries(projectBreakdown)
      .map(([id, v]) => ({ projectId: Number(id), ...v }))
      .sort((a, b) => b.seconds - a.seconds),
  });
});

router.get("/time-tracker/client/:clientId", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const entries = await db.select().from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.clientId, clientId), eq(timeEntriesTable.userId, userId)))
    .orderBy(desc(timeEntriesTable.startedAt));

  const monthStart = monthStartStr();
  const thisMonthEntries = entries.filter(e => e.startedAt.toISOString().slice(0, 10) >= monthStart);

  const sumDuration = (arr: typeof entries) => arr.reduce((s, e) => s + (e.durationSeconds ?? 0), 0);
  const sumBillable = (arr: typeof entries) => arr.filter(e => e.isBillable).reduce((s, e) => s + (e.durationSeconds ?? 0), 0);

  const byActivityType: Record<string, number> = {};
  for (const e of thisMonthEntries) {
    const t = e.activityType ?? "Altro";
    byActivityType[t] = (byActivityType[t] ?? 0) + (e.durationSeconds ?? 0);
  }

  res.json({
    totalAllTime: sumDuration(entries),
    totalThisMonth: sumDuration(thisMonthEntries),
    billableThisMonth: sumBillable(thisMonthEntries),
    nonBillableThisMonth: sumDuration(thisMonthEntries) - sumBillable(thisMonthEntries),
    entriesCount: entries.length,
    byActivityType: Object.entries(byActivityType).map(([type, seconds]) => ({ type, seconds })),
    recentEntries: entries.slice(0, 20).map(e => ({
      ...e,
      startedAt: e.startedAt?.toISOString(),
      endedAt: e.endedAt?.toISOString(),
      createdAt: e.createdAt?.toISOString(),
      updatedAt: e.updatedAt?.toISOString(),
    })),
  });
});

router.post("/time-tracker/seed", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const existing = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.userId, userId)).limit(1);
  if (existing.length > 0) {
    res.json({ success: true, skipped: true }); return;
  }

  const [clients, projects] = await Promise.all([
    db.select().from(clientsTable).limit(5),
    db.select().from(projectsTable).limit(5),
  ]);

  if (clients.length === 0) {
    res.json({ success: true, skipped: true, reason: "no clients" }); return;
  }

  const activityTypes = [
    "Creazione contenuti",
    "Gestione campagne ADV",
    "Strategia e pianificazione",
    "Reportistica",
    "Riunione / Call con cliente",
  ];

  const now = new Date();
  const seedEntries = [];

  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const numEntries = daysAgo === 0 ? 1 : Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < numEntries; i++) {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const project = projects.find(p => p.clientId === client.id) ?? projects[0];
      const startHour = 9 + Math.floor(Math.random() * 7);
      const durationMin = 30 + Math.floor(Math.random() * 150);

      const start = new Date(d);
      start.setHours(startHour, Math.floor(Math.random() * 60), 0, 0);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);

      seedEntries.push({
        userId,
        clientId: client.id,
        projectId: project?.id ?? null,
        taskId: null,
        description: `${activityTypes[Math.floor(Math.random() * activityTypes.length)]} per ${client.name}`,
        activityType: activityTypes[Math.floor(Math.random() * activityTypes.length)],
        startedAt: start,
        endedAt: end,
        durationSeconds: durationMin * 60,
        isBillable: Math.random() > 0.2,
        isManual: false,
        pausedSeconds: 0,
      });
    }
  }

  for (const entry of seedEntries) {
    await db.insert(timeEntriesTable).values(entry);
  }

  res.json({ success: true, entriesCreated: seedEntries.length });
});

export default router;
