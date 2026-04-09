import { Router, type IRouter } from "express";
import { ilike, or, sql } from "drizzle-orm";
import { db, clientsTable, projectsTable, tasksTable, quoteTemplatesTable, contractsTable } from "@workspace/db";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const q = (req.query.q as string ?? "").trim();
  if (q.length < 2) { res.json({ clients: [], projects: [], tasks: [], quotes: [], contracts: [] }); return; }

  const accessible = await getAccessibleClientIds(userId);
  const pattern = `%${q}%`;

  const [clients, projects, tasks, quotes, contracts] = await Promise.all([
    db.select({ id: clientsTable.id, name: clientsTable.name, company: clientsTable.company })
      .from(clientsTable)
      .where(or(ilike(clientsTable.name, pattern), ilike(clientsTable.company, pattern)))
      .limit(5),
    db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status, clientId: projectsTable.clientId })
      .from(projectsTable)
      .where(ilike(projectsTable.name, pattern))
      .limit(5),
    db.select({ id: tasksTable.id, title: tasksTable.title, status: tasksTable.status, projectId: tasksTable.projectId })
      .from(tasksTable)
      .where(ilike(tasksTable.title, pattern))
      .limit(5),
    db.select({ id: quoteTemplatesTable.id, name: quoteTemplatesTable.name, status: quoteTemplatesTable.status, clientId: quoteTemplatesTable.clientId })
      .from(quoteTemplatesTable)
      .where(ilike(quoteTemplatesTable.name, pattern))
      .limit(5),
    db.select({ id: contractsTable.id, numero: contractsTable.numero, oggetto: contractsTable.oggetto, clientId: contractsTable.clientId })
      .from(contractsTable)
      .where(or(ilike(contractsTable.numero, pattern), ilike(contractsTable.oggetto, pattern)))
      .limit(5),
  ]);

  const filterByAccess = <T extends { clientId?: number | null }>(items: T[]) => {
    if (accessible === "all") return items;
    return items.filter((i) => !i.clientId || accessible.includes(i.clientId));
  };

  const filteredProjects = filterByAccess(projects);
  const accessibleProjectIds = filteredProjects.map((p) => p.id);

  const filteredTasks = accessible === "all" ? tasks : tasks.filter((t) => {
    if (!t.projectId) return true;
    return accessibleProjectIds.includes(t.projectId);
  });

  res.json({
    clients: accessible === "all" ? clients : clients.filter((c) => accessible.includes(c.id)),
    projects: filteredProjects,
    tasks: filteredTasks,
    quotes: filterByAccess(quotes),
    contracts: filterByAccess(contracts),
  });
});

export default router;
