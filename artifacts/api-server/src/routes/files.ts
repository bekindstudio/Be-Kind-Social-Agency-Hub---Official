import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, filesTable, projectsTable } from "@workspace/db";
import {
  CreateFileBody,
  DeleteFileParams,
  ListFilesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/files", async (req, res): Promise<void> => {
  const query = ListFilesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const files = await db.select().from(filesTable).orderBy(filesTable.createdAt);
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  let result = files.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    projectName: f.projectId ? (projectMap.get(f.projectId) ?? null) : null,
  }));

  if (query.data.projectId != null) {
    result = result.filter((f) => f.projectId === query.data.projectId);
  }

  res.json(result);
});

router.post("/files", async (req, res): Promise<void> => {
  const parsed = CreateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [file] = await db.insert(filesTable).values(parsed.data).returning();
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  res.status(201).json({
    ...file,
    projectName: file.projectId ? (projectMap.get(file.projectId) ?? null) : null,
  });
});

router.delete("/files/:id", async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [file] = await db.delete(filesTable).where(eq(filesTable.id, params.data.id)).returning();
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
