import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, projectsTable, clientsTable } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  ListProjectsQueryParams,
} from "@workspace/api-zod";
import { getUserId as getUid, isEnvAdmin, getAccessibleClientIds, filterByClientAccess } from "../lib/access-control";

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

function serializeProject(
  project: typeof projectsTable.$inferSelect,
  clientName: string | null
) {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    clientName,
    budget: project.budget != null ? Number(project.budget) : null,
  };
}

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  const clients = await db.select().from(clientsTable);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const accessible = userId ? await getAccessibleClientIds(userId) : "all" as const;
  const accessFiltered = filterByClientAccess(projects, accessible);

  let result = accessFiltered
    .filter((p) => canViewProject(p, userId))
    .map((p) => serializeProject(p, p.clientId ? (clientMap.get(p.clientId) ?? null) : null));

  if (query.data.clientId != null) {
    result = result.filter((p) => p.clientId === query.data.clientId);
  }
  if (query.data.status != null) {
    result = result.filter((p) => p.status === query.data.status);
  }

  res.json(result);
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const [project] = await db.insert(projectsTable).values({
    ...parsed.data,
    budget: parsed.data.budget != null ? String(parsed.data.budget) : null,
    createdBy: userId,
  }).returning();

  const clients = await db.select().from(clientsTable);
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

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
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

  const clients = await db.select().from(clientsTable);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  res.json(serializeProject(project, project.clientId ? (clientMap.get(project.clientId) ?? null) : null));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  // Fetch existing project to check access
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!canViewProject(existing, userId)) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.clientId !== undefined) updates.clientId = parsed.data.clientId;
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.progress != null) updates.progress = parsed.data.progress;
  if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;
  if (parsed.data.budget !== undefined) updates.budget = parsed.data.budget != null ? String(parsed.data.budget) : null;
  if ((req.body as any).category !== undefined) updates.category = (req.body as any).category;
  // Only admin or creator can toggle isPrivate
  if (parsed.data.isPrivate !== undefined && parsed.data.isPrivate !== null) {
    if (isAdmin(userId) || existing.createdBy === userId) {
      updates.isPrivate = parsed.data.isPrivate;
    }
  }

  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const clients = await db.select().from(clientsTable);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  res.json(serializeProject(project, project.clientId ? (clientMap.get(project.clientId) ?? null) : null));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!canViewProject(existing, userId)) {
    res.status(403).json({ error: "Accesso non autorizzato" });
    return;
  }

  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
