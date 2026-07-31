import { Router, type IRouter } from "express";
import { eq, and, asc, isNull, inArray, count, sql } from "drizzle-orm";
import { z } from "zod";
import { db, messagesTable, projectsTable, teamMembersTable } from "@workspace/db";
import {
  CreateMessageBody,
  DeleteMessageParams,
  ListMessagesQueryParams,
} from "@workspace/api-zod";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";

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

  // ACL enforcement: utenti non-admin vedono solo messaggi di progetti dei
  // clienti a cui hanno accesso. Messaggi senza projectId (room comune team)
  // restano visibili a tutti gli utenti autenticati.
  const accessible = canDeleteAll ? ("all" as const) : await getAccessibleClientIds(userId);
  const isAccessibleProject = (projectId: number | null) => {
    if (projectId == null) return true;
    if (accessible === "all") return true;
    const cid = projectClientMap.get(projectId);
    if (cid == null) return true; // progetto interno senza cliente
    return accessible.includes(cid);
  };

  let result = messages
    .filter((m) => isAccessibleProject(m.projectId))
    .map((m) => ({
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

/* ── CHAT PER CLIENTE (filo diretto cliente↔agenzia) ──────────── */

function serializeChat(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    content: m.content,
    authorName: m.authorName,
    authorColor: m.authorColor,
    source: m.source,
    createdAt: m.createdAt.toISOString(),
  };
}

async function assertClientAccess(userId: string, clientId: number): Promise<boolean> {
  if (isEnvAdmin(userId)) return true;
  const accessible = await getAccessibleClientIds(userId);
  return accessible === "all" || accessible.includes(clientId);
}

// Riepilogo non letti per cliente (per il pallino nella lista/sidebar).
// Registrato PRIMA di /clients/:id/messages: "messages" non è un id numerico.
router.get("/clients/messages/unread", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId);
  const conds = [eq(messagesTable.source, "client"), isNull(messagesTable.readAt), sql`${messagesTable.clientId} is not null`];
  if (accessible !== "all") {
    if (accessible.length === 0) { res.json({ total: 0, byClient: {} }); return; }
    conds.push(inArray(messagesTable.clientId, accessible));
  }
  const rows = await db
    .select({ clientId: messagesTable.clientId, n: count() })
    .from(messagesTable)
    .where(and(...conds))
    .groupBy(messagesTable.clientId);
  const byClient: Record<number, number> = {};
  let total = 0;
  for (const r of rows) { if (r.clientId != null) { byClient[r.clientId] = Number(r.n); total += Number(r.n); } }
  res.json({ total, byClient });
});

// Thread del cliente lato agenzia (sotto login). Aprendolo timbra come letti i
// messaggi del cliente → spegne il pallino.
router.get("/clients/:id/messages", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const clientId = Number(req.params.id);
  if (!Number.isFinite(clientId)) { res.status(400).json({ error: "ID cliente non valido" }); return; }
  if (!(await assertClientAccess(userId, clientId))) { res.status(403).json({ error: "Accesso negato" }); return; }

  await db.update(messagesTable)
    .set({ readAt: new Date() })
    .where(and(eq(messagesTable.clientId, clientId), eq(messagesTable.source, "client"), isNull(messagesTable.readAt)));

  const rows = await db.select().from(messagesTable)
    .where(eq(messagesTable.clientId, clientId))
    .orderBy(asc(messagesTable.createdAt));
  res.json(rows.map(serializeChat));
});

const clientMessageBody = z.object({ content: z.string().trim().min(1).max(4000) });

router.post("/clients/:id/messages", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const clientId = Number(req.params.id);
  if (!Number.isFinite(clientId)) { res.status(400).json({ error: "ID cliente non valido" }); return; }
  if (!(await assertClientAccess(userId, clientId))) { res.status(403).json({ error: "Accesso negato" }); return; }
  const parsed = clientMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const member = await getTeamMemberForUser(userId);
  const [row] = await db.insert(messagesTable).values({
    content: parsed.data.content,
    clientId,
    source: "agency",
    authorId: member?.id ?? null,
    authorName: member?.name ?? "Be Kind",
    authorColor: normalizeAuthorColor(member?.avatarColor ?? undefined),
  }).returning();
  res.status(201).json(serializeChat(row));
});

export default router;
