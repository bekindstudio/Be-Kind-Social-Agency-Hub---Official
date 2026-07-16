import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, clientContentIdeasTable, clientsTable } from "@workspace/db";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";
import { validate } from "../middlewares/validate";
import { derivePlatform, normalizeExternalUrl } from "../lib/social-url";

/**
 * Banca Idee: archivio di link "ispirazione" per cliente (reel/post visti in
 * giro, da riprendere quando si producono i contenuti). Lato agenzia è CRUD
 * completo; il cliente inserisce e consulta dall'area pubblica senza login
 * (vedi public-portal.ts).
 *
 * `platform` è sempre derivata dall'url e mai letta dal body: l'url è l'unica
 * fonte di verità.
 */
const router: IRouter = Router();

const IDEA_STATUSES = ["da_valutare", "approvata", "realizzata"] as const;

const createIdeaSchema = z.object({
  title: z.string().trim().min(1, "Il titolo è obbligatorio").max(300),
  url: z.string().trim().min(1, "Il link è obbligatorio").max(2000),
  status: z.enum(IDEA_STATUSES).default("da_valutare"),
  notes: z.string().trim().max(5_000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
}).passthrough();

const updateIdeaSchema = createIdeaSchema.partial().passthrough();

async function checkClientAccess(req: Request, res: Response): Promise<{ userId: string; clientId: number } | null> {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return null; }
  const clientId = parseInt(req.params.clientId as string, 10);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    res.status(400).json({ error: "ID cliente non valido" });
    return null;
  }
  const accessible = await getAccessibleClientIds(userId);
  if (accessible !== "all" && !accessible.includes(clientId)) {
    res.status(403).json({ error: "Accesso non autorizzato a questo cliente" });
    return null;
  }
  return { userId, clientId };
}

function serializeIdea(i: typeof clientContentIdeasTable.$inferSelect) {
  return {
    ...i,
    createdAt: i.createdAt?.toISOString?.() ?? null,
    updatedAt: i.updatedAt?.toISOString?.() ?? null,
  };
}

/**
 * Vista cross-cliente per la pagina /banca-idee: tutte le idee dei clienti a cui
 * l'utente ha accesso, con il nome del cliente già dentro per evitare una
 * seconda query lato frontend. Definita PRIMA delle rotte /clients/:clientId/...
 * perché sono path distinti, ma l'ordine qui è comunque irrilevante: Express
 * matcha per path esatto, non per prefisso.
 */
router.get("/content-ideas", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const accessible = await getAccessibleClientIds(userId);
  if (accessible !== "all" && accessible.length === 0) { res.json([]); return; }

  const rows = await db
    .select({ idea: clientContentIdeasTable, clientName: clientsTable.name })
    .from(clientContentIdeasTable)
    .innerJoin(clientsTable, eq(clientContentIdeasTable.clientId, clientsTable.id))
    .where(accessible === "all" ? undefined : inArray(clientContentIdeasTable.clientId, accessible))
    .orderBy(desc(clientContentIdeasTable.createdAt));

  res.json(rows.map((r) => ({ ...serializeIdea(r.idea), clientName: r.clientName })));
});

router.get("/clients/:clientId/content-ideas", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const rows = await db
    .select()
    .from(clientContentIdeasTable)
    .where(eq(clientContentIdeasTable.clientId, ctx.clientId))
    .orderBy(desc(clientContentIdeasTable.createdAt));
  res.json(rows.map(serializeIdea));
});

router.post("/clients/:clientId/content-ideas", validate(createIdeaSchema), async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const body = req.body as z.infer<typeof createIdeaSchema>;
  const url = normalizeExternalUrl(body.url);
  if (!url) {
    res.status(400).json({ error: "Link non valido. Incolla un URL completo (es. https://www.instagram.com/reel/…)." });
    return;
  }
  const [created] = await db.insert(clientContentIdeasTable).values({
    clientId: ctx.clientId,
    title: body.title.trim(),
    url,
    platform: derivePlatform(url),
    source: "agency",
    status: body.status,
    notes: body.notes?.trim() || null,
    tags: body.tags ?? [],
    createdBy: ctx.userId,
  }).returning();
  res.status(201).json(serializeIdea(created));
});

router.patch("/clients/:clientId/content-ideas/:ideaId", validate(updateIdeaSchema), async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const ideaId = parseInt(req.params.ideaId as string, 10);
  if (!Number.isFinite(ideaId) || ideaId <= 0) { res.status(400).json({ error: "ID idea non valido" }); return; }

  const body = req.body as z.infer<typeof updateIdeaSchema>;
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.url === "string") {
    const url = normalizeExternalUrl(body.url);
    if (!url) { res.status(400).json({ error: "Link non valido." }); return; }
    updates.url = url;
    updates.platform = derivePlatform(url);
  }
  if (typeof body.status === "string") updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (Array.isArray(body.tags)) updates.tags = body.tags;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }

  // La coppia (id, clientId) è l'unica difesa IDOR: la policy RLS è permissiva.
  const [updated] = await db
    .update(clientContentIdeasTable)
    .set(updates)
    .where(and(eq(clientContentIdeasTable.id, ideaId), eq(clientContentIdeasTable.clientId, ctx.clientId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Idea non trovata" }); return; }
  res.json(serializeIdea(updated));
});

router.delete("/clients/:clientId/content-ideas/:ideaId", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const ideaId = parseInt(req.params.ideaId as string, 10);
  if (!Number.isFinite(ideaId) || ideaId <= 0) { res.status(400).json({ error: "ID idea non valido" }); return; }
  await db
    .delete(clientContentIdeasTable)
    .where(and(eq(clientContentIdeasTable.id, ideaId), eq(clientContentIdeasTable.clientId, ctx.clientId)));
  res.sendStatus(204);
});

export default router;
