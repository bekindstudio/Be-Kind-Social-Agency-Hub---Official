import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { aiConversations, aiMessages } from "@workspace/db";
import {
  clientBriefs,
  clientReportsTable,
  clientsTable,
  editorialPlansTable,
  editorialSlotsTable,
  projectsTable,
  tasksTable,
} from "@workspace/db";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getAccessibleClientIds, getUserId } from "../lib/access-control";

const router = Router();
const PRIVATE_PORTAL_AI_ONLY = !["false", "0", "off", "no"].includes(
  (process.env.PRIVATE_PORTAL_AI_ONLY ?? "true").trim().toLowerCase(),
);

type PortalSnapshot = {
  clientCount: number;
  clients: Array<{ id: number; name: string; sector: string | null; healthScore: number | null; contractStatus: string | null }>;
  projectStats: { total: number; active: number; delayed: number; atRisk: number };
  openTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  briefsWithoutStrategy: number;
  reportsInBozza: number;
  upcomingEditorialSlots: Array<{ date: string; title: string; platform: string; status: string; clientName: string }>;
};

function parsePositiveInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  return userId;
}

function isPastDate(raw: unknown): boolean {
  if (!raw) return false;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function toIsoDay(raw: unknown): string {
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function inNextDays(raw: unknown, days: number): boolean {
  if (!raw) return false;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return false;
  const now = Date.now();
  const end = now + days * 24 * 60 * 60 * 1000;
  return d.getTime() >= now && d.getTime() <= end;
}

async function getPortalSnapshot(userId: string): Promise<PortalSnapshot> {
  const access = await getAccessibleClientIds(userId);
  const onlyIds = access === "all" ? null : access.length > 0 ? access : [-1];

  const clients =
    onlyIds == null
      ? await db.select().from(clientsTable)
      : await db.select().from(clientsTable).where(inArray(clientsTable.id, onlyIds));

  const projects =
    onlyIds == null
      ? await db.select().from(projectsTable)
      : await db.select().from(projectsTable).where(inArray(projectsTable.clientId, onlyIds));

  const tasks =
    onlyIds == null
      ? await db.select().from(tasksTable)
      : await db.select().from(tasksTable).where(inArray(tasksTable.clientId, onlyIds));

  const briefs =
    onlyIds == null
      ? await db.select().from(clientBriefs)
      : await db.select().from(clientBriefs).where(inArray(clientBriefs.clientId, onlyIds));

  const reports =
    onlyIds == null
      ? await db.select().from(clientReportsTable)
      : await db.select().from(clientReportsTable).where(inArray(clientReportsTable.clientId, onlyIds));

  const plans =
    onlyIds == null
      ? await db.select().from(editorialPlansTable)
      : await db.select().from(editorialPlansTable).where(inArray(editorialPlansTable.clientId, onlyIds));
  const planIds = plans.map((item) => item.id);
  const slots =
    planIds.length > 0
      ? await db.select().from(editorialSlotsTable).where(inArray(editorialSlotsTable.planId, planIds))
      : [];
  const clientNameById = new Map(clients.map((item) => [item.id, item.name]));
  const planClientById = new Map(plans.map((item) => [item.id, item.clientId]));

  const upcomingEditorialSlots = slots
    .filter((slot) => inNextDays(slot.publishDate, 14))
    .sort((a, b) => String(a.publishDate ?? "").localeCompare(String(b.publishDate ?? "")))
    .slice(0, 8)
    .map((slot) => ({
      date: toIsoDay(slot.publishDate),
      title: slot.title || "Contenuto editoriale",
      platform: slot.platform || "N/D",
      status: slot.status || "N/D",
      clientName: clientNameById.get(planClientById.get(slot.planId) ?? -1) ?? "Cliente",
    }));

  return {
    clientCount: clients.length,
    clients: clients.slice(0, 10).map((item) => ({
      id: item.id,
      name: item.name,
      sector: item.settore,
      healthScore: item.healthScore,
      contractStatus: item.contractStatus,
    })),
    projectStats: {
      total: projects.length,
      active: projects.filter((item) => item.status === "active").length,
      delayed: projects.filter((item) => item.healthStatus === "delayed").length,
      atRisk: projects.filter((item) => item.healthStatus === "at-risk").length,
    },
    openTasks: tasks.filter((item) => item.status !== "done").length,
    overdueTasks: tasks.filter((item) => item.status !== "done" && isPastDate(item.dueDate)).length,
    unassignedTasks: tasks.filter((item) => item.status !== "done" && !item.assigneeId).length,
    briefsWithoutStrategy: briefs.filter((item) => (item.strategyStatus ?? "empty") !== "ready").length,
    reportsInBozza: reports.filter((item) => item.status === "bozza").length,
    upcomingEditorialSlots,
  };
}

function buildPrivatePortalReply(userPrompt: string, snapshot: PortalSnapshot): string {
  const normalized = userPrompt.toLowerCase();
  const focusBrief = /(brief|strategia)/.test(normalized);
  const focusCalendar = /(calendar|calendario|editoriale|post)/.test(normalized);
  const focusReports = /(report|kpi|analytics)/.test(normalized);
  const focusTasks = /(task|todo|operativ)/.test(normalized);

  const actions: string[] = [];
  if (snapshot.overdueTasks > 0) actions.push(`Sblocca le task scadute: ${snapshot.overdueTasks} risultano oltre la deadline.`);
  if (snapshot.unassignedTasks > 0) actions.push(`Assegna ownership: ${snapshot.unassignedTasks} task sono senza owner.`);
  if (snapshot.briefsWithoutStrategy > 0) actions.push(`Completa allineamento brief/strategia su ${snapshot.briefsWithoutStrategy} clienti.`);
  if (snapshot.reportsInBozza > 0) actions.push(`Chiudi il ciclo report: ${snapshot.reportsInBozza} report sono in bozza.`);
  if (snapshot.upcomingEditorialSlots.length > 0) actions.push(`Valida il calendario editoriale dei prossimi 14 giorni per evitare blocchi in pubblicazione.`);
  if (actions.length === 0) actions.push("Nessuna criticita immediata: puoi concentrarti su ottimizzazione contenuti e crescita.");

  const lines: string[] = [];
  lines.push("Analisi privata interna completata. Nessun dato e stato inviato a provider esterni.");
  lines.push("");
  lines.push("## Snapshot portale");
  lines.push(`- Clienti monitorati: ${snapshot.clientCount}`);
  lines.push(`- Progetti: ${snapshot.projectStats.total} totali (${snapshot.projectStats.active} attivi, ${snapshot.projectStats.atRisk} at-risk, ${snapshot.projectStats.delayed} in ritardo)`);
  lines.push(`- Task aperte: ${snapshot.openTasks} (scadute: ${snapshot.overdueTasks}, senza owner: ${snapshot.unassignedTasks})`);
  lines.push(`- Brief senza strategia pronta: ${snapshot.briefsWithoutStrategy}`);
  lines.push(`- Report in bozza: ${snapshot.reportsInBozza}`);

  if (focusCalendar || (!focusBrief && !focusReports && !focusTasks)) {
    lines.push("");
    lines.push("## Calendario editoriale (prossimi 14 giorni)");
    if (snapshot.upcomingEditorialSlots.length === 0) {
      lines.push("- Nessuno slot editoriale pianificato nei prossimi 14 giorni.");
    } else {
      snapshot.upcomingEditorialSlots.forEach((slot) => {
        lines.push(`- ${slot.date} · ${slot.clientName} · ${slot.platform} · ${slot.title} (${slot.status})`);
      });
    }
  }

  if (focusBrief) {
    lines.push("");
    lines.push("## Focus brief e strategia");
    lines.push(`- Clienti da completare: ${snapshot.briefsWithoutStrategy}`);
    lines.push("- Priorita: allineare obiettivi, target, tone of voice e pilastri contenuto prima della prossima pianificazione.");
  }

  if (focusReports) {
    lines.push("");
    lines.push("## Focus report");
    lines.push(`- Report in bozza: ${snapshot.reportsInBozza}`);
    lines.push("- Suggerimento: chiudi prima i report con KPI pronti e pianifica follow-up cliente nello stesso ciclo.");
  }

  if (focusTasks) {
    lines.push("");
    lines.push("## Focus operativo task");
    lines.push(`- Task aperte: ${snapshot.openTasks}`);
    lines.push(`- Scadute: ${snapshot.overdueTasks}`);
    lines.push(`- Senza owner: ${snapshot.unassignedTasks}`);
  }

  lines.push("");
  lines.push("## Azioni consigliate");
  actions.slice(0, 5).forEach((action) => lines.push(`- ${action}`));

  return lines.join("\n");
}

function buildSystemPrompt(context?: { type?: string; data?: any }, snapshot?: PortalSnapshot): string {
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  let prompt = `Sei un esperto assistente di marketing digitale che lavora all'interno di Agency Hub, una piattaforma usata dall'agenzia di marketing di Michael Balleroni con sede a Pesaro, Italia. L'agenzia e specializzata in gestione social media, creazione contenuti, Meta Ads e Google Ads per clienti PMI italiani.

Rispondi sempre in italiano a meno che l'utente non scriva in un'altra lingua.
Sii pratico, conciso e professionale. Dai consigli specifici e attuabili.
Quando suggerisci idee per contenuti, adattale al mercato e alla cultura italiana.
Oggi e il ${today}.`;

  if (snapshot) {
    prompt += `\n\nSNAPSHOT OPERATIVO PORTALE:
- Clienti: ${snapshot.clientCount}
- Progetti attivi: ${snapshot.projectStats.active} (at-risk: ${snapshot.projectStats.atRisk}, ritardo: ${snapshot.projectStats.delayed})
- Task aperte: ${snapshot.openTasks} (scadute: ${snapshot.overdueTasks}, senza owner: ${snapshot.unassignedTasks})
- Brief da completare: ${snapshot.briefsWithoutStrategy}
- Report in bozza: ${snapshot.reportsInBozza}`;
  }

  if (!context?.type || context.type === "general") return prompt;

  if (context.type === "project" && context.data) {
    const d = context.data;
    prompt += `\n\nCONTESTO PROGETTO:
- Progetto: ${d.name ?? "N/D"}
- Cliente: ${d.clientName ?? "N/D"}
- Stato: ${d.status ?? "N/D"}
- Budget: ${d.budget ? `EUR ${d.budget}` : "N/D"}
- Periodo: ${d.startDate ?? "?"} — ${d.endDate ?? "in corso"}`;
    if (d.tasks?.length) {
      prompt += `\n- Task attivi: ${d.tasks.map((t: any) => `${t.title} (${t.status})`).join(", ")}`;
    }
  }

  if (context.type === "client" && context.data) {
    const d = context.data;
    prompt += `\n\nCONTESTO CLIENTE:
- Cliente: ${d.name ?? "N/D"}
- Settore: ${d.sector ?? "N/D"}
- Progetti attivi: ${d.activeProjects ?? 0}`;
    if (d.contractEndDate) prompt += `\n- Scadenza contratto: ${d.contractEndDate}`;
  }

  if (context.type === "report" && context.data) {
    const d = context.data;
    prompt += `\n\nCONTESTO REPORT:
- Cliente: ${d.clientName ?? "N/D"}
- Periodo: ${d.period ?? "N/D"}`;
    if (d.kpi) {
      const k = d.kpi;
      prompt += `\n- Follower: ${k.followers ?? "N/D"}, Reach: ${k.reach ?? "N/D"}, Engagement rate: ${k.engagementRate ?? "N/D"}`;
      if (k.adSpend) prompt += `, Spesa ads: EUR ${k.adSpend}, ROAS: ${k.roas ?? "N/D"}`;
    }
    prompt += `\nAiuta a scrivere sezioni del report basandoti sui dati reali forniti.`;
  }

  return prompt;
}

router.get("/anthropic/conversations", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const rows = await db.select().from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt));
  res.json(rows);
});

router.post("/anthropic/conversations", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { title, contextType, contextId } = req.body;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  const [row] = await db.insert(aiConversations).values({
    title,
    userId,
    contextType: contextType ?? "general",
    contextId: contextId ?? null,
  }).returning();
  res.status(201).json(row);
});

router.get("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = parsePositiveInt(req.params.id);
  if (!id) { res.status(400).json({ error: "ID conversazione non valido" }); return; }
  const [conv] = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.patch("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = parsePositiveInt(req.params.id);
  if (!id) { res.status(400).json({ error: "ID conversazione non valido" }); return; }
  const updates: any = {};
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.isStarred !== undefined) updates.isStarred = req.body.isStarred;
  updates.updatedAt = new Date();
  const [row] = await db.update(aiConversations).set(updates)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = parsePositiveInt(req.params.id);
  if (!id) { res.status(400).json({ error: "ID conversazione non valido" }); return; }
  const [row] = await db.delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.get("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = parsePositiveInt(req.params.id);
  if (!id) { res.status(400).json({ error: "ID conversazione non valido" }); return; }
  const [conv] = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));
  res.json(msgs);
});

router.post("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const convId = parsePositiveInt(req.params.id);
  if (!convId) { res.status(400).json({ error: "ID conversazione non valido" }); return; }
  const { content, context } = req.body;
  if (!String(content ?? "").trim()) { res.status(400).json({ error: "content is required" }); return; }

  const [conv] = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, convId), eq(aiConversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(aiMessages).values({ conversationId: convId, role: "user", content });

  const history = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, convId)).orderBy(asc(aiMessages.createdAt));
  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const portalSnapshot = await getPortalSnapshot(userId);
  const systemPrompt = buildSystemPrompt(context, portalSnapshot);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  let totalTokens = 0;
  let clientDisconnected = false;

  req.on("close", () => {
    clientDisconnected = true;
  });

  if (PRIVATE_PORTAL_AI_ONLY) {
    try {
      const privateReply = buildPrivatePortalReply(String(content), portalSnapshot);
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ content: privateReply })}\n\n`);
      }
      await db.insert(aiMessages).values({
        conversationId: convId,
        role: "assistant",
        content: privateReply,
        tokensUsed: null,
      });
      await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, convId));
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ done: true, privacyMode: "private_internal" })}\n\n`);
        res.end();
      }
    } catch (err: any) {
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ error: err?.message ?? "Errore AI privata" })}\n\n`);
        res.end();
      }
    }
    return;
  }

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (clientDisconnected) {
        stream.abort();
        break;
      }
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        if (!clientDisconnected) {
          try {
            res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
          } catch { clientDisconnected = true; }
        }
      }
      if (event.type === "message_delta" && (event as any).usage) {
        totalTokens = (event as any).usage.output_tokens ?? 0;
      }
    }

    if (fullResponse) {
      await db.insert(aiMessages).values({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
        tokensUsed: totalTokens || null,
      });
      await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, convId));
    }

    if (!clientDisconnected) {
      try {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch {}
    }
  } catch (err: any) {
    console.error("AI chat error:", err.message);
    if (!clientDisconnected) {
      try {
        res.write(`data: ${JSON.stringify({ error: "AI non disponibile al momento. Riprova tra poco." })}\n\n`);
        res.end();
      } catch {}
    }
  }
});

router.patch("/anthropic/messages/:messageId/feedback", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const messageId = parsePositiveInt(req.params.messageId);
  if (!messageId) { res.status(400).json({ error: "ID messaggio non valido" }); return; }
  const { feedback } = req.body;
  if (feedback !== "positive" && feedback !== "negative" && feedback !== null) {
    res.status(400).json({ error: "feedback non valido" });
    return;
  }
  const [msg] = await db.select({ conversationId: aiMessages.conversationId }).from(aiMessages).where(eq(aiMessages.id, messageId));
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  const [conv] = await db.select({ userId: aiConversations.userId }).from(aiConversations).where(eq(aiConversations.id, msg.conversationId));
  if (!conv || conv.userId !== userId) { res.status(403).json({ error: "Non autorizzato" }); return; }
  const [row] = await db.update(aiMessages).set({ feedback }).where(eq(aiMessages.id, messageId)).returning();
  res.json(row);
});

export default router;
