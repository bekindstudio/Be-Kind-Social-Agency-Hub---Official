import { Router, type IRouter } from "express";
import { eq, and, sql, desc, asc, gte, lte, inArray } from "drizzle-orm";
import {
  db,
  tasksTable,
  projectsTable,
  teamMembersTable,
  clientsTable,
  dailyFocusSessionsTable,
  taskFocusActionsTable,
} from "@workspace/db";
import { getUserId, isEnvAdmin } from "../lib/access-control";

const router: IRouter = Router();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeFocusScore(task: typeof tasksTable.$inferSelect): {
  score: number;
  quadrant: number;
} {
  let score = 0;
  const priority = (task.priority ?? "medium").toLowerCase();
  if (priority === "urgente") score += 100;
  else if (priority === "alta") score += 75;
  else if (priority === "media" || priority === "medium") score += 50;
  else if (priority === "bassa" || priority === "low") score += 25;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let daysUntilDue = 999;
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    daysUntilDue = Math.floor(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilDue < 0) score += 50;
    else if (daysUntilDue === 0) score += 40;
    else if (daysUntilDue === 1) score += 30;
    else if (daysUntilDue <= 3) score += 20;
    else if (daysUntilDue <= 7) score += 10;
  }

  if (task.projectId || task.clientId) score += 15;
  if ((task.estimatedHours ?? 0) > 0 && (task.estimatedHours ?? 0) <= 1) score += 5;
  if (String(task.description ?? "").toLowerCase().includes("blocca")) score += 10;

  let quadrant: number;
  const isUrgent = daysUntilDue <= 1;
  const isImportant =
    priority === "urgente" || priority === "alta" || priority === "medium" || priority === "media";

  if (isUrgent && isImportant) quadrant = 1;
  else if (!isUrgent && isImportant) quadrant = 2;
  else if (isUrgent && !isImportant) quadrant = 3;
  else quadrant = 4;

  return { score, quadrant };
}

router.get("/daily-focus", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const teamMember = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  const memberName =
    teamMember[0]
      ? `${teamMember[0].name ?? ""} ${teamMember[0].surname ?? ""}`.trim()
      : null;

  let tasks;
  if (memberId) {
    tasks = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.assigneeId, memberId),
          sql`${tasksTable.status} != 'done'`,
        ),
      );
  } else {
    tasks = await db
      .select()
      .from(tasksTable)
      .where(sql`${tasksTable.status} != 'done'`);
  }

  if (tasks.length === 0) {
    const now = new Date();
    await db.insert(tasksTable).values([
      {
        title: "Consegnare grafiche Spring a Fiore Moda",
        description: "Dipendenza cliente: materiali finali per calendario editoriale",
        priority: "alta",
        dueDate: addDays(now, 0),
        status: "todo",
        categoria: "Design",
        assigneeId: memberId,
        estimatedHours: 1,
      },
      {
        title: "Attivare campagna Meta TechNova",
        description: "Task bloccante per l'avvio lead generation",
        priority: "urgente",
        dueDate: addDays(now, -1),
        status: "todo",
        categoria: "ADV",
        assigneeId: memberId,
        estimatedHours: 2,
      },
      {
        title: "Preparare piano editoriale Maggio — Rossi & Partners",
        priority: "alta",
        dueDate: addDays(now, 5),
        status: "todo",
        categoria: "Piano Editoriale",
        assigneeId: memberId,
      },
      {
        title: "Scrivere caption 8 post Instagram Fiore Moda",
        priority: "media",
        dueDate: addDays(now, 3),
        status: "todo",
        categoria: "Copy",
        assigneeId: memberId,
      },
      {
        title: "Aggiornare spreadsheet ore lavorate",
        priority: "bassa",
        dueDate: addDays(now, 1),
        status: "todo",
        categoria: "Admin",
        assigneeId: memberId,
      },
      {
        title: "Riorganizzare cartelle Drive clienti",
        priority: "bassa",
        dueDate: addDays(now, 20),
        status: "todo",
        categoria: "Organizzazione",
        assigneeId: memberId,
      },
    ]);
    if (memberId) {
      tasks = await db.select().from(tasksTable).where(
        and(eq(tasksTable.assigneeId, memberId), sql`${tasksTable.status} != 'done'`),
      );
    } else {
      tasks = await db.select().from(tasksTable).where(sql`${tasksTable.status} != 'done'`);
    }
  }

  const [projects, members, clients] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(teamMembersTable),
    db.select().from(clientsTable),
  ]);
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const scored = tasks.map((t) => {
    const { score, quadrant } = computeFocusScore(t);
    const project = t.projectId ? projectMap.get(t.projectId) : null;
    const assignee = t.assigneeId ? memberMap.get(t.assigneeId) : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectId: t.projectId,
      projectName: project?.name ?? null,
      clientId: project?.clientId ?? null,
      clientName: project?.clientId
        ? (clients.find((c) => c.id === project.clientId)?.name ?? null)
        : null,
      assigneeId: t.assigneeId,
      assigneeName: assignee
        ? `${assignee.name ?? ""} ${assignee.surname ?? ""}`.trim()
        : null,
      categoria: t.categoria,
      checklistJson: t.checklistJson,
      estimatedHours: t.estimatedHours,
      pacchettoContenuti: t.pacchettoContenuti,
      score,
      quadrant,
      postponedCount: t.postponedCount,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const today = todayStr();
  const [session] = await db
    .select()
    .from(dailyFocusSessionsTable)
    .where(
      and(
        eq(dailyFocusSessionsTable.userId, userId),
        eq(dailyFocusSessionsTable.date, today),
      ),
    );

  const todayActions = await db
    .select()
    .from(taskFocusActionsTable)
    .where(
      and(
        eq(taskFocusActionsTable.userId, userId),
        eq(taskFocusActionsTable.date, today),
      ),
    );

  res.json({
    memberName,
    tasks: scored,
    session: session ?? null,
    todayActions,
    teamMembers: members
      .filter((m) => m.isActive)
      .map((m) => ({
        id: m.id,
        name: `${m.name ?? ""} ${m.surname ?? ""}`.trim(),
      })),
  });
});

router.post("/daily-focus/session", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const today = todayStr();
  const { tasksShownJson, tasksCompletedJson, tasksSkippedJson, tasksDelegatedJson, tasksPostponedJson, completionRate } = req.body;

  const [existing] = await db
    .select()
    .from(dailyFocusSessionsTable)
    .where(
      and(
        eq(dailyFocusSessionsTable.userId, userId),
        eq(dailyFocusSessionsTable.date, today),
      ),
    );

  if (existing) {
    const updates: any = {};
    if (tasksShownJson !== undefined) updates.tasksShownJson = tasksShownJson;
    if (tasksCompletedJson !== undefined)
      updates.tasksCompletedJson = tasksCompletedJson;
    if (tasksSkippedJson !== undefined)
      updates.tasksSkippedJson = tasksSkippedJson;
    if (tasksDelegatedJson !== undefined)
      updates.tasksDelegatedJson = tasksDelegatedJson;
    if (tasksPostponedJson !== undefined)
      updates.tasksPostponedJson = tasksPostponedJson;
    if (completionRate !== undefined) updates.completionRate = completionRate;
    updates.closedAt = new Date();
    const [updated] = await db
      .update(dailyFocusSessionsTable)
      .set(updates)
      .where(eq(dailyFocusSessionsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(dailyFocusSessionsTable)
      .values({
        userId,
        date: today,
        tasksShownJson: tasksShownJson ?? [],
        tasksCompletedJson: tasksCompletedJson ?? [],
        tasksSkippedJson: tasksSkippedJson ?? [],
        tasksDelegatedJson: tasksDelegatedJson ?? [],
        tasksPostponedJson: tasksPostponedJson ?? [],
        completionRate: completionRate ?? 0,
      })
      .returning();
    res.status(201).json(created);
  }
});

router.post("/daily-focus/action", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const { taskId, action, note } = req.body;
  if (!taskId || !action) {
    res.status(400).json({ error: "taskId e action obbligatori" });
    return;
  }

  const validActions = [
    "viewed",
    "started",
    "completed",
    "skipped",
    "delegated",
    "postponed",
  ];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "Azione non valida" });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, Number(taskId)));
  if (!task) { res.status(404).json({ error: "Task non trovata" }); return; }

  const teamMember = await db.select().from(teamMembersTable).where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  if (memberId && task.assigneeId && task.assigneeId !== memberId && !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Non puoi modificare task assegnate ad altri" }); return;
  }

  if (action === "started") {
    await db.update(tasksTable).set({ status: "in-progress" }).where(eq(tasksTable.id, Number(taskId)));
  } else if (action === "completed") {
    try {
      await db.update(tasksTable).set({ status: "done", completedFromFocus: true, completedAt: new Date() }).where(eq(tasksTable.id, Number(taskId)));
    } catch {
      await db.update(tasksTable).set({ status: "done", completedAt: new Date() }).where(eq(tasksTable.id, Number(taskId)));
    }
  } else if (action === "postponed") {
    const currentDue = task.dueDate ? new Date(task.dueDate) : new Date();
    currentDue.setDate(currentDue.getDate() + 1);
    await db.update(tasksTable).set({
      dueDate: currentDue.toISOString().slice(0, 10),
      lastPostponedAt: new Date(),
      postponedCount: (task.postponedCount ?? 0) + 1,
    }).where(eq(tasksTable.id, Number(taskId)));
  } else if (action === "delegated") {
    const { newAssigneeId } = req.body;
    if (newAssigneeId) {
      await db.update(tasksTable).set({ assigneeId: Number(newAssigneeId) }).where(eq(tasksTable.id, Number(taskId)));
    }
  }

  const [logged] = await db
    .insert(taskFocusActionsTable)
    .values({
      userId,
      taskId: Number(taskId),
      date: todayStr(),
      action,
      note: note ?? null,
    })
    .returning();

  res.status(201).json(logged);
});

router.get("/daily-focus/should-open", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const today = todayStr();
  const [session] = await db.select().from(dailyFocusSessionsTable).where(
    and(eq(dailyFocusSessionsTable.userId, userId), eq(dailyFocusSessionsTable.date, today)),
  );
  if (!session) {
    res.json({ shouldOpen: true, reason: "first_open_today", highlightUrgentOnly: false });
    return;
  }
  const teamMember = await db.select().from(teamMembersTable).where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  let openTasks = await db.select().from(tasksTable).where(sql`${tasksTable.status} != 'done'`);
  if (memberId) openTasks = openTasks.filter((t) => t.assigneeId === memberId);
  const lastSeen = session.closedAt ?? session.openedAt;
  const newUrgent = openTasks.filter((t) => {
    const created = t.createdAt ? new Date(t.createdAt) : null;
    if (!created || !lastSeen) return false;
    const scored = computeFocusScore(t);
    return created > lastSeen && scored.quadrant === 1;
  });
  if (newUrgent.length > 0) {
    res.json({ shouldOpen: true, reason: "new_urgent_tasks", highlightUrgentOnly: true, urgentTaskIds: newUrgent.map((t) => t.id) });
    return;
  }
  res.json({ shouldOpen: false, reason: "already_seen_today", highlightUrgentOnly: false });
});

router.get("/daily-focus/stats", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const sessions = await db
    .select()
    .from(dailyFocusSessionsTable)
    .where(
      and(
        eq(dailyFocusSessionsTable.userId, userId),
        gte(dailyFocusSessionsTable.date, weekStartStr),
      ),
    )
    .orderBy(asc(dailyFocusSessionsTable.date));

  const actions = await db
    .select()
    .from(taskFocusActionsTable)
    .where(
      and(
        eq(taskFocusActionsTable.userId, userId),
        gte(taskFocusActionsTable.date, weekStartStr),
      ),
    );

  const dayNames = [
    "Lunedi",
    "Martedi",
    "Mercoledi",
    "Giovedi",
    "Venerdi",
    "Sabato",
    "Domenica",
  ];

  const dailyStats = dayNames.map((name, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayActions = actions.filter((a) => a.date === dateStr);
    return {
      day: name,
      date: dateStr,
      completed: dayActions.filter((a) => a.action === "completed").length,
      started: dayActions.filter((a) => a.action === "started").length,
      skipped: dayActions.filter((a) => a.action === "skipped").length,
      delegated: dayActions.filter((a) => a.action === "delegated").length,
    };
  });

  const totalCompleted = actions.filter(
    (a) => a.action === "completed",
  ).length;
  const totalDelegated = actions.filter(
    (a) => a.action === "delegated",
  ).length;
  const avgRate =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.completionRate ?? 0), 0) /
        sessions.length
      : 0;

  let streak = 0;
  const checkDate = new Date(today);
  for (let i = 0; i < 30; i++) {
    const dStr = checkDate.toISOString().slice(0, 10);
    const session = sessions.find((s) => s.date === dStr);
    if (session && (session.completionRate ?? 0) > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  res.json({
    dailyStats,
    totalCompleted,
    totalDelegated,
    avgCompletionRate: Math.round(avgRate * 100) / 100,
    streak,
    sessionsCount: sessions.length,
  });
});

export default router;
