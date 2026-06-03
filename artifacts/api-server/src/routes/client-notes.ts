import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, clientNotesTable } from "@workspace/db";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";
import { validate } from "../middlewares/validate";

/**
 * CRUD note/idee libere per cliente. Diverso dal brief strutturato: ogni nota
 * è una card autonoma con contenuto testuale libero, colore opzionale e flag
 * "pinned" per metterla in cima. Usato per appuntare al volo idee, telefonate,
 * promemoria che non hanno ancora forma di task o evento.
 */
const router: IRouter = Router();

const createNoteSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  color: z.string().trim().max(20).optional(),
  pinned: z.boolean().optional(),
}).passthrough();

const updateNoteSchema = createNoteSchema.partial().passthrough();

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

function serializeNote(n: typeof clientNotesTable.$inferSelect) {
  return {
    ...n,
    createdAt: n.createdAt?.toISOString?.() ?? null,
    updatedAt: n.updatedAt?.toISOString?.() ?? null,
  };
}

router.get("/clients/:clientId/notes", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  // Pinned in cima, poi per data più recente.
  const rows = await db
    .select()
    .from(clientNotesTable)
    .where(eq(clientNotesTable.clientId, ctx.clientId))
    .orderBy(desc(clientNotesTable.pinned), desc(clientNotesTable.createdAt));
  res.json(rows.map(serializeNote));
});

router.post("/clients/:clientId/notes", validate(createNoteSchema), async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const body = req.body as z.infer<typeof createNoteSchema>;
  const [created] = await db.insert(clientNotesTable).values({
    clientId: ctx.clientId,
    content: body.content.trim(),
    color: body.color?.trim() || "#fef3c7",
    pinned: Boolean(body.pinned),
    createdBy: ctx.userId,
  }).returning();
  res.status(201).json(serializeNote(created));
});

router.patch("/clients/:clientId/notes/:noteId", validate(updateNoteSchema), async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const noteId = parseInt(req.params.noteId as string, 10);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    res.status(400).json({ error: "ID nota non valido" });
    return;
  }
  const body = req.body as z.infer<typeof updateNoteSchema>;
  const updates: Record<string, unknown> = {};
  if (typeof body.content === "string") updates.content = body.content.trim();
  if (typeof body.color === "string") updates.color = body.color.trim() || "#fef3c7";
  if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }

  const [updated] = await db
    .update(clientNotesTable)
    .set(updates)
    .where(and(eq(clientNotesTable.id, noteId), eq(clientNotesTable.clientId, ctx.clientId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Nota non trovata" }); return; }
  res.json(serializeNote(updated));
});

router.delete("/clients/:clientId/notes/:noteId", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;
  const noteId = parseInt(req.params.noteId as string, 10);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    res.status(400).json({ error: "ID nota non valido" });
    return;
  }
  await db
    .delete(clientNotesTable)
    .where(and(eq(clientNotesTable.id, noteId), eq(clientNotesTable.clientId, ctx.clientId)));
  res.sendStatus(204);
});

export default router;
