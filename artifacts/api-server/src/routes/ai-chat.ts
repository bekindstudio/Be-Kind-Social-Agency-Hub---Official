import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { aiConversations, aiMessages } from "@workspace/db";
import { eq, desc, asc, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getUserId } from "../lib/access-control";

const router = Router();

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  return userId;
}

function buildSystemPrompt(context?: { type?: string; data?: any }): string {
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  let prompt = `Sei un esperto assistente di marketing digitale che lavora all'interno di Agency Hub, una piattaforma usata dall'agenzia di marketing di Michael Balleroni con sede a Pesaro, Italia. L'agenzia e specializzata in gestione social media, creazione contenuti, Meta Ads e Google Ads per clienti PMI italiani.

Rispondi sempre in italiano a meno che l'utente non scriva in un'altra lingua.
Sii pratico, conciso e professionale. Dai consigli specifici e attuabili.
Quando suggerisci idee per contenuti, adattale al mercato e alla cultura italiana.
Oggi e il ${today}.`;

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
  const id = parseInt(req.params.id);
  const [conv] = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.patch("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = parseInt(req.params.id);
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
  const id = parseInt(req.params.id);
  const [row] = await db.delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.get("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const id = parseInt(req.params.id);
  const [conv] = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, id)).orderBy(asc(aiMessages.createdAt));
  res.json(msgs);
});

router.post("/anthropic/conversations/:id/messages", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const convId = parseInt(req.params.id);
  const { content, context } = req.body;
  if (!content) { res.status(400).json({ error: "content is required" }); return; }

  const [conv] = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, convId), eq(aiConversations.userId, userId)));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(aiMessages).values({ conversationId: convId, role: "user", content });

  const history = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, convId)).orderBy(asc(aiMessages.createdAt));
  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const systemPrompt = buildSystemPrompt(context);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  let totalTokens = 0;
  let clientDisconnected = false;

  req.on("close", () => {
    clientDisconnected = true;
  });

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
  const messageId = parseInt(req.params.messageId);
  const { feedback } = req.body;
  const [msg] = await db.select({ conversationId: aiMessages.conversationId }).from(aiMessages).where(eq(aiMessages.id, messageId));
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  const [conv] = await db.select({ userId: aiConversations.userId }).from(aiConversations).where(eq(aiConversations.id, msg.conversationId));
  if (!conv || conv.userId !== userId) { res.status(403).json({ error: "Non autorizzato" }); return; }
  const [row] = await db.update(aiMessages).set({ feedback }).where(eq(aiMessages.id, messageId)).returning();
  res.json(row);
});

export default router;
