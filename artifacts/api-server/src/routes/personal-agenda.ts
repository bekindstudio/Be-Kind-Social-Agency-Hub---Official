import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db, personalAgendaEventsTable } from "@workspace/db";
import { getUserId } from "../lib/access-control";
import { validate } from "../middlewares/validate";

/**
 * Agenda personale dell'utente. Tipi supportati:
 *  - call    → telefonata / videocall
 *  - meeting → riunione interna
 *  - in_sede → appuntamento in sede (cliente o ufficio)
 *
 * Ogni record è privato all'owner (userId). Niente ACL multi-tenant qui:
 * il check è `userId === currentUser`. RLS DB-side rafforza il vincolo.
 */
const router: IRouter = Router();

const eventTypeSchema = z.enum(["call", "meeting", "in_sede"]);

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(500),
  type: eventTypeSchema,
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  attendees: z.string().max(2000).optional().nullable(),
}).passthrough();

const updateEventSchema = createEventSchema.partial().passthrough();

function requireUserId(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  return userId;
}

function parseDateOrThrow(v: unknown, field: string): Date {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} mancante`);
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw new Error(`${field} non valida`);
  return d;
}

function serializeEvent(e: typeof personalAgendaEventsTable.$inferSelect) {
  return {
    ...e,
    startAt: e.startAt?.toISOString?.() ?? null,
    endAt: e.endAt?.toISOString?.() ?? null,
    createdAt: e.createdAt?.toISOString?.() ?? null,
    updatedAt: e.updatedAt?.toISOString?.() ?? null,
  };
}

router.get("/personal-agenda", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  // Query param `from`/`to` opzionali per limitare la finestra (es. mese
  // corrente). Senza, restituisce tutti gli eventi dell'utente ordinati per
  // data crescente — ordinamento naturale per un'agenda.
  const fromRaw = typeof req.query.from === "string" ? req.query.from : null;
  const toRaw = typeof req.query.to === "string" ? req.query.to : null;
  const conds = [eq(personalAgendaEventsTable.userId, userId)];
  if (fromRaw) {
    const d = new Date(fromRaw);
    if (Number.isFinite(d.getTime())) conds.push(gte(personalAgendaEventsTable.startAt, d));
  }
  if (toRaw) {
    const d = new Date(toRaw);
    if (Number.isFinite(d.getTime())) conds.push(lte(personalAgendaEventsTable.startAt, d));
  }
  const rows = await db
    .select()
    .from(personalAgendaEventsTable)
    .where(and(...conds))
    .orderBy(personalAgendaEventsTable.startAt);
  res.json(rows.map(serializeEvent));
});

router.post("/personal-agenda", validate(createEventSchema), async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as z.infer<typeof createEventSchema>;
  let startAt: Date;
  let endAt: Date | null = null;
  try {
    startAt = parseDateOrThrow(body.startAt, "startAt");
    if (body.endAt) endAt = parseDateOrThrow(body.endAt, "endAt");
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Date non valide" });
    return;
  }
  const [created] = await db.insert(personalAgendaEventsTable).values({
    userId,
    title: body.title.trim(),
    type: body.type,
    startAt,
    endAt,
    location: body.location?.trim() || null,
    notes: body.notes?.trim() || null,
    attendees: body.attendees?.trim() || null,
  }).returning();
  res.status(201).json(serializeEvent(created));
});

router.patch("/personal-agenda/:id", validate(updateEventSchema), async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const eventId = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    res.status(400).json({ error: "ID evento non valido" });
    return;
  }
  const body = req.body as z.infer<typeof updateEventSchema>;
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.type === "string") updates.type = body.type;
  if (typeof body.startAt === "string") {
    try { updates.startAt = parseDateOrThrow(body.startAt, "startAt"); }
    catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "startAt non valida" }); return; }
  }
  if (body.endAt !== undefined) {
    if (body.endAt === null || body.endAt === "") {
      updates.endAt = null;
    } else {
      try { updates.endAt = parseDateOrThrow(body.endAt, "endAt"); }
      catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "endAt non valida" }); return; }
    }
  }
  if (body.location !== undefined) updates.location = body.location ? String(body.location).trim() : null;
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;
  if (body.attendees !== undefined) updates.attendees = body.attendees ? String(body.attendees).trim() : null;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nessun campo da aggiornare" });
    return;
  }
  const [updated] = await db
    .update(personalAgendaEventsTable)
    .set(updates)
    .where(and(
      eq(personalAgendaEventsTable.id, eventId),
      eq(personalAgendaEventsTable.userId, userId),
    ))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Evento non trovato" });
    return;
  }
  res.json(serializeEvent(updated));
});

router.delete("/personal-agenda/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const eventId = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    res.status(400).json({ error: "ID evento non valido" });
    return;
  }
  await db
    .delete(personalAgendaEventsTable)
    .where(and(
      eq(personalAgendaEventsTable.id, eventId),
      eq(personalAgendaEventsTable.userId, userId),
    ));
  res.sendStatus(204);
});

export default router;
