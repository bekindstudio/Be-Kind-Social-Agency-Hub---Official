import { Router, type IRouter } from "express";
import { db, tasksTable, projectsTable, contractsTable, notifications, clientsTable } from "@workspace/db";
import { eq, and, lte, gte, not, sql, inArray } from "drizzle-orm";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";

const router: IRouter = Router();

router.post("/deadlines/check", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const today = new Date();
  const in3days = new Date(); in3days.setDate(today.getDate() + 3);
  const in7days = new Date(); in7days.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().slice(0, 10);
  const in3str = in3days.toISOString().slice(0, 10);
  const in7str = in7days.toISOString().slice(0, 10);

  let created = 0;

  const accessible = await getAccessibleClientIds(userId);

  const allOverdueTasks = await db.select({
    id: tasksTable.id,
    title: tasksTable.title,
    status: tasksTable.status,
    dueDate: tasksTable.dueDate,
    projectId: tasksTable.projectId,
  }).from(tasksTable)
    .where(and(
      not(eq(tasksTable.status, "done")),
      lte(tasksTable.dueDate, todayStr)
    ));

  let accessibleProjectIds: number[] | null = null;
  if (accessible !== "all") {
    const accessibleProjects = await db.select({ id: projectsTable.id }).from(projectsTable)
      .where(inArray(projectsTable.clientId, accessible));
    accessibleProjectIds = accessibleProjects.map(p => p.id);
  }

  const filterTaskByAccess = (t: { projectId: number | null }) => {
    if (accessible === "all") return true;
    if (!t.projectId) return true;
    return accessibleProjectIds!.includes(t.projectId);
  };

  const overdueTasks = allOverdueTasks.filter(filterTaskByAccess);

  for (const t of overdueTasks) {
    const existing = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, "deadline"),
        sql`${notifications.message} LIKE ${"%" + `task-${t.id}-overdue` + "%"}`
      ));
    if (existing.length === 0) {
      await db.insert(notifications).values({
        userId, type: "deadline",
        title: `Task scaduto: ${t.title}`,
        message: `Il task "${t.title}" e' scaduto il ${t.dueDate}. [task-${t.id}-overdue]`,
        link: "/tasks",
      });
      created++;
    }
  }

  const allUpcomingTasks = await db.select({
    id: tasksTable.id,
    title: tasksTable.title,
    status: tasksTable.status,
    dueDate: tasksTable.dueDate,
    projectId: tasksTable.projectId,
  }).from(tasksTable)
    .where(and(
      not(eq(tasksTable.status, "done")),
      gte(tasksTable.dueDate, todayStr),
      lte(tasksTable.dueDate, in3str)
    ));
  const upcomingTasks = allUpcomingTasks.filter(filterTaskByAccess);

  for (const t of upcomingTasks) {
    const existing = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, "deadline"),
        sql`${notifications.message} LIKE ${"%" + `task-${t.id}-upcoming` + "%"}`
      ));
    if (existing.length === 0) {
      await db.insert(notifications).values({
        userId, type: "deadline",
        title: `Task in scadenza: ${t.title}`,
        message: `Il task "${t.title}" scade il ${t.dueDate}. [task-${t.id}-upcoming]`,
        link: "/tasks",
      });
      created++;
    }
  }

  const contractConditions = [
    eq(contractsTable.stato, "firmato"),
    gte(contractsTable.dataFine, todayStr),
    lte(contractsTable.dataFine, in7str),
  ];
  if (accessible !== "all") {
    contractConditions.push(inArray(contractsTable.clientId, accessible));
  }
  const expiringContracts = await db.select({
    id: contractsTable.id,
    numero: contractsTable.numero,
    oggetto: contractsTable.oggetto,
    dataFine: contractsTable.dataFine,
    clientName: clientsTable.name,
  })
    .from(contractsTable)
    .leftJoin(clientsTable, eq(contractsTable.clientId, clientsTable.id))
    .where(and(...contractConditions));

  for (const c of expiringContracts) {
    const existing = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, "deadline"),
        sql`${notifications.message} LIKE ${"%" + `contract-${c.id}-expiring` + "%"}`
      ));
    if (existing.length === 0) {
      await db.insert(notifications).values({
        userId, type: "deadline",
        title: `Contratto in scadenza: ${c.numero}`,
        message: `Il contratto "${c.oggetto}" (${c.clientName ?? ""}) scade il ${c.dataFine}. [contract-${c.id}-expiring]`,
        link: "/contracts",
      });
      created++;
    }
  }

  const projectConditions = [
    not(eq(projectsTable.status, "completed")),
    not(eq(projectsTable.status, "on-hold")),
    gte(projectsTable.deadline, todayStr),
    lte(projectsTable.deadline, in3str),
  ];
  if (accessible !== "all") {
    projectConditions.push(inArray(projectsTable.clientId, accessible));
  }
  const projectDeadlines = await db.select().from(projectsTable)
    .where(and(...projectConditions));

  for (const p of projectDeadlines) {
    const existing = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, "deadline"),
        sql`${notifications.message} LIKE ${"%" + `project-${p.id}-deadline` + "%"}`
      ));
    if (existing.length === 0) {
      await db.insert(notifications).values({
        userId, type: "deadline",
        title: `Progetto in scadenza: ${p.name}`,
        message: `Il progetto "${p.name}" scade il ${p.deadline}. [project-${p.id}-deadline]`,
        link: `/projects/${p.id}`,
      });
      created++;
    }
  }

  res.json({ checked: true, notificationsCreated: created });
});

export default router;
