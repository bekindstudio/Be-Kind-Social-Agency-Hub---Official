import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, messagesTable, projectsTable } from "@workspace/db";
import {
  CreateMessageBody,
  DeleteMessageParams,
  ListMessagesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/messages", async (req, res): Promise<void> => {
  const query = ListMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const messages = await db.select().from(messagesTable).orderBy(messagesTable.createdAt);
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  let result = messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    projectName: m.projectId ? (projectMap.get(m.projectId) ?? null) : null,
  }));

  if (query.data.projectId != null) {
    result = result.filter((m) => m.projectId === query.data.projectId);
  }

  res.json(result);
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [message] = await db.insert(messagesTable).values(parsed.data).returning();
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  res.status(201).json({
    ...message,
    projectName: message.projectId ? (projectMap.get(message.projectId) ?? null) : null,
  });
});

router.delete("/messages/:id", async (req, res): Promise<void> => {
  const params = DeleteMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [message] = await db.delete(messagesTable).where(eq(messagesTable.id, params.data.id)).returning();
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
