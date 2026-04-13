import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, messagesTable, projectsTable, teamMembersTable } from "@workspace/db";
import {
  CreateMessageBody,
  DeleteMessageParams,
  ListMessagesQueryParams,
} from "@workspace/api-zod";
import { getUserId, isEnvAdmin } from "../lib/access-control";

const router: IRouter = Router();

function normalizeAuthorColor(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return "#6366f1";
}

async function getTeamMemberForUser(authUserId: string) {
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.authUserId, authUserId));
  return member ?? null;
}

router.get("/messages", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const query = ListMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rawClientId = req.query.clientId;
  const clientId = rawClientId != null && rawClientId !== "" ? Number(rawClientId) : null;
  const messages = await db.select().from(messagesTable).orderBy(messagesTable.createdAt);
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const projectClientMap = new Map(projects.map((p) => [p.id, p.clientId ?? null]));
  const teamMember = await getTeamMemberForUser(userId);
  const canDeleteAll = isEnvAdmin(userId);

  let result = messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    projectName: m.projectId ? (projectMap.get(m.projectId) ?? null) : null,
    canDelete: canDeleteAll || (teamMember?.id != null && m.authorId === teamMember.id),
  }));

  if (query.data.projectId != null) {
    result = result.filter((m) => m.projectId === query.data.projectId);
  }
  if (clientId != null && Number.isFinite(clientId)) {
    result = result.filter((m) => {
      if (m.projectId == null) return false;
      return projectClientMap.get(m.projectId) === clientId;
    });
  }

  res.json(result);
});

router.post("/messages", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const content = parsed.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Messaggio vuoto" });
    return;
  }
  if (content.length > 4000) {
    res.status(400).json({ error: "Messaggio troppo lungo (max 4000 caratteri)" });
    return;
  }
  const member = await getTeamMemberForUser(userId);
  const fallbackName = parsed.data.authorName.trim() || "Utente";
  const resolvedAuthorName = member
    ? `${member.name} ${member.surname ?? ""}`.trim()
    : fallbackName;
  const [message] = await db
    .insert(messagesTable)
    .values({
      ...parsed.data,
      content,
      authorId: member?.id ?? null,
      authorName: resolvedAuthorName,
      authorColor: normalizeAuthorColor(parsed.data.authorColor),
    })
    .returning();
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  res.status(201).json({
    ...message,
    projectName: message.projectId ? (projectMap.get(message.projectId) ?? null) : null,
    canDelete: true,
  });
});

router.delete("/messages/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const params = DeleteMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  const canDeleteAll = isEnvAdmin(userId);
  if (!canDeleteAll) {
    const member = await getTeamMemberForUser(userId);
    const canDeleteOwn = member?.id != null && existing.authorId === member.id;
    if (!canDeleteOwn) {
      res.status(403).json({ error: "Non autorizzato a eliminare questo messaggio" });
      return;
    }
  }
  await db.delete(messagesTable).where(eq(messagesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
