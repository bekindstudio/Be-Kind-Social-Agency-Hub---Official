import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, personalAgendaEventsTable } from "@workspace/db";
import { getUserId } from "../lib/access-control";
import { validate } from "../middlewares/validate";
import { expandSeries, RECURRENCES } from "../lib/recurrence";

/**
 * Agenda personale dell'utente. Tipi supportati:
 *  - call    → telefonata / videocall
 *  - meeting → riunione interna
 *  - in_sede → appuntamento in sede (cliente o ufficio)
 *
 * Ogni record è privato all'owner (userId). Niente ACL multi-tenant qui:
 * il check è `userId === currentUser`. RLS DB-side rafforza il vincolo.
 *
 * RICORRENZE: una serie è una riga sola; le occorrenze le calcola la GET
 * (lib/recurrence.ts). Quindi la GET può restituire più elementi con lo stesso
 * `id`, distinti da `startAt`: il frontend deve usare `id + startAt` come chiave.
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
  recurrence: z.enum(RECURRENCES).optional().nullable(),
  recurrenceUntil: z.string().optional().nullable(),
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
    recurrenceUntil: e.recurrenceUntil?.toISOString?.() ?? null,
    recurrenceExceptions: undefined,
    createdAt: e.createdAt?.toISOString?.() ?? null,
    updatedAt: e.updatedAt?.toISOString?.() ?? null,
  };
}

/** Finestra di default quando il client non passa from/to: un anno indietro,
 *  due avanti. Serve a dare un limite all'espansione delle serie senza fine. */
const DEFAULT_BACK_MS = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_FWD_MS = 2 * 365 * 24 * 60 * 60 * 1000;

router.get("/personal-agenda", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  // `from`/`to` limitano la finestra (es. mese corrente). Senza, si usa la
  // finestra di default: NON si può più filtrare in SQL su start_at, perché una
  // serie iniziata anni fa genera occorrenze dentro la finestra di oggi. Quindi
  // si leggono le righe dell'utente (poche: sono serie, non occorrenze) e si
  // espande in memoria.
  const now = Date.now();
  const parseWindow = (raw: unknown, fallback: number): Date => {
    if (typeof raw === "string" && raw.trim()) {
      const d = new Date(raw);
      if (Number.isFinite(d.getTime())) return d;
    }
    return new Date(fallback);
  };
  const windowFrom = parseWindow(req.query.from, now - DEFAULT_BACK_MS);
  const windowTo = parseWindow(req.query.to, now + DEFAULT_FWD_MS);

  const rows = await db
    .select()
    .from(personalAgendaEventsTable)
    .where(eq(personalAgendaEventsTable.userId, userId))
    .orderBy(personalAgendaEventsTable.startAt);

  const out: ReturnType<typeof serializeEvent>[] = [];
  for (const row of rows) {
    const occurrences = expandSeries(
      {
        startAt: row.startAt,
        endAt: row.endAt,
        recurrence: row.recurrence,
        recurrenceUntil: row.recurrenceUntil,
        recurrenceExceptions: row.recurrenceExceptions,
      },
      windowFrom,
      windowTo,
    );
    for (const occ of occurrences) {
      out.push({
        ...serializeEvent(row),
        startAt: occ.startAt.toISOString(),
        endAt: occ.endAt ? occ.endAt.toISOString() : null,
        // `seriesStartAt` distingue la prima occorrenza dalle ripetizioni e
        // serve al frontend per l'eccezione "elimina solo questa".
        seriesStartAt: row.startAt.toISOString(),
      } as ReturnType<typeof serializeEvent> & { seriesStartAt: string });
    }
  }
  out.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
  res.json(out);
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
  // La data di fine ricorrenza senza ricorrenza non significa niente (e il DB
  // la rifiuta con un CHECK): la scarto invece di far fallire l'inserimento.
  const recurrence = body.recurrence || null;
  let recurrenceUntil: Date | null = null;
  if (recurrence && body.recurrenceUntil) {
    try {
      recurrenceUntil = parseDateOrThrow(body.recurrenceUntil, "recurrenceUntil");
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Data di fine non valida" });
      return;
    }
    if (recurrenceUntil.getTime() < startAt.getTime()) {
      res.status(400).json({ error: "La data di fine ripetizione è prima dell'inizio" });
      return;
    }
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
    recurrence,
    recurrenceUntil,
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
  // Togliendo la ricorrenza va tolta anche la data di fine, altrimenti il CHECK
  // del DB rifiuta la riga (until senza recurrence).
  if (body.recurrence !== undefined) {
    updates.recurrence = body.recurrence || null;
    if (!body.recurrence) {
      updates.recurrenceUntil = null;
      updates.recurrenceExceptions = [];
    }
  }
  if (body.recurrenceUntil !== undefined) {
    if (!body.recurrenceUntil) {
      updates.recurrenceUntil = null;
    } else {
      try { updates.recurrenceUntil = parseDateOrThrow(body.recurrenceUntil, "recurrenceUntil"); }
      catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Data di fine non valida" }); return; }
    }
  }
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

/**
 * DELETE /personal-agenda/:id
 *   - senza parametri            → elimina l'evento o l'INTERA serie
 *   - ?occurrence=<ISO>          → salta SOLO quell'occorrenza (la serie resta),
 *                                  aggiungendola alle eccezioni
 */
router.delete("/personal-agenda/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const eventId = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    res.status(400).json({ error: "ID evento non valido" });
    return;
  }

  const occurrenceRaw = typeof req.query.occurrence === "string" ? req.query.occurrence : null;
  if (occurrenceRaw) {
    const occ = new Date(occurrenceRaw);
    if (!Number.isFinite(occ.getTime())) {
      res.status(400).json({ error: "Occorrenza non valida" });
      return;
    }
    const [row] = await db
      .select()
      .from(personalAgendaEventsTable)
      .where(and(
        eq(personalAgendaEventsTable.id, eventId),
        eq(personalAgendaEventsTable.userId, userId),
      ));
    if (!row) { res.status(404).json({ error: "Evento non trovato" }); return; }
    if (!row.recurrence) {
      res.status(400).json({ error: "Questo appuntamento non si ripete: eliminalo del tutto." });
      return;
    }
    // Idempotente: saltare due volte la stessa occorrenza non deve duplicare
    // l'eccezione né fallire.
    const already = (row.recurrenceExceptions ?? []).some((d) => new Date(d).getTime() === occ.getTime());
    if (!already) {
      await db
        .update(personalAgendaEventsTable)
        .set({ recurrenceExceptions: [...(row.recurrenceExceptions ?? []), occ] })
        .where(and(
          eq(personalAgendaEventsTable.id, eventId),
          eq(personalAgendaEventsTable.userId, userId),
        ));
    }
    res.sendStatus(204);
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
