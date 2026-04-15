import { Router, type Request, type Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, clientEventsTable } from "@workspace/db";
import { getAccessibleClientIds, getUserId } from "../lib/access-control";
import { logger } from "../lib/logger";
import { validate } from "../middlewares/validate";

const router = Router();

const eventTypeSchema = z.enum([
  "campaign",
  "launch",
  "deadline",
  "meeting",
  "other",
]);
const eventPrioritySchema = z.enum(["low", "medium", "high"]);

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(255),
  date: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  type: eventTypeSchema.default("other"),
  priority: eventPrioritySchema.default("medium"),
  note: z.string().optional(),
});

const updateEventSchema = createEventSchema.partial();

function parseClientId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function ensureClientAccess(
  req: Request,
  res: Response,
): Promise<{ userId: string; clientId: number } | null> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }

  const clientId = parseClientId(req.params.clientId as string);
  if (!clientId) {
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

function serializeEvent(row: typeof clientEventsTable.$inferSelect) {
  return {
    ...row,
    date: row.date.toISOString(),
    endDate: row.endDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/:clientId/events", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req, res);
  if (!ctx) return;

  try {
    const rows = await db
      .select()
      .from(clientEventsTable)
      .where(eq(clientEventsTable.clientId, ctx.clientId))
      .orderBy(asc(clientEventsTable.date));
    res.json(rows.map(serializeEvent));
  } catch (err) {
    logger.error({ err, clientId: ctx.clientId }, "Get client events error");
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.post(
  "/:clientId/events",
  validate(createEventSchema),
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      const payload = req.body as z.infer<typeof createEventSchema>;
      const [row] = await db
        .insert(clientEventsTable)
        .values({
          clientId: ctx.clientId,
          title: payload.title,
          date: new Date(payload.date),
          endDate: payload.endDate ? new Date(payload.endDate) : null,
          type: payload.type,
          priority: payload.priority,
          note: payload.note ?? null,
        })
        .returning();

      res.status(201).json(serializeEvent(row));
    } catch (err) {
      logger.error({ err, clientId: ctx.clientId }, "Create client event error");
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

router.patch(
  "/:clientId/events/:eventId",
  validate(updateEventSchema),
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      const payload = req.body as z.infer<typeof updateEventSchema>;
      const [row] = await db
        .update(clientEventsTable)
        .set({
          ...payload,
          date:
            payload.date === undefined ? undefined : new Date(payload.date),
          endDate:
            payload.endDate === undefined
              ? undefined
              : payload.endDate
                ? new Date(payload.endDate)
                : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clientEventsTable.id, req.params.eventId as string),
            eq(clientEventsTable.clientId, ctx.clientId),
          ),
        )
        .returning();

      if (!row) {
        res.status(404).json({ error: "EVENT_NOT_FOUND" });
        return;
      }

      res.json(serializeEvent(row));
    } catch (err) {
      logger.error(
        { err, clientId: ctx.clientId, eventId: req.params.eventId },
        "Update client event error",
      );
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

router.delete("/:clientId/events/:eventId", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req, res);
  if (!ctx) return;

  try {
    await db
      .delete(clientEventsTable)
      .where(
        and(
          eq(clientEventsTable.id, req.params.eventId as string),
          eq(clientEventsTable.clientId, ctx.clientId),
        ),
      );
    res.status(204).end();
  } catch (err) {
    logger.error(
      { err, clientId: ctx.clientId, eventId: req.params.eventId },
      "Delete client event error",
    );
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;
