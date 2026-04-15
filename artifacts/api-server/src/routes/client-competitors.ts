import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, clientCompetitorsTable } from "@workspace/db";
import { getAccessibleClientIds, getUserId } from "../lib/access-control";
import { logger } from "../lib/logger";
import { validate } from "../middlewares/validate";

const router = Router();

const competitorPlatformSchema = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "x",
]);

const createCompetitorSchema = z.object({
  name: z.string().trim().min(1).max(255),
  profileUrl: z.string().url().optional().or(z.literal("")).default(""),
  platform: competitorPlatformSchema,
  followers: z.number().int().min(0).default(0),
  followersPrevious: z.number().int().min(0).optional(),
  engagementRate: z.number().min(0).default(0),
  postsPerWeek: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
  notes: z.string().default(""),
  topContent: z.string().optional(),
  observedStrategy: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  updateHistory: z
    .array(
      z.object({
        date: z.string(),
        followers: z.number(),
        engagementRate: z.number(),
        postsPerWeek: z.number(),
        note: z.string().optional(),
      }),
    )
    .default([]),
});

const updateCompetitorSchema = createCompetitorSchema.partial();

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

function serializeCompetitor(row: typeof clientCompetitorsTable.$inferSelect) {
  return {
    ...row,
    engagementRate: Number(row.engagementRate ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/:clientId/competitors", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req, res);
  if (!ctx) return;

  try {
    const rows = await db
      .select()
      .from(clientCompetitorsTable)
      .where(eq(clientCompetitorsTable.clientId, ctx.clientId))
      .orderBy(desc(clientCompetitorsTable.updatedAt));
    res.json(rows.map(serializeCompetitor));
  } catch (err) {
    logger.error(
      { err, clientId: ctx.clientId },
      "Get client competitors error",
    );
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.post(
  "/:clientId/competitors",
  validate(createCompetitorSchema),
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      const payload = req.body as z.infer<typeof createCompetitorSchema>;
      const [row] = await db
        .insert(clientCompetitorsTable)
        .values({
          clientId: ctx.clientId,
          name: payload.name,
          profileUrl: payload.profileUrl,
          platform: payload.platform,
          followers: payload.followers,
          followersPrevious: payload.followersPrevious ?? null,
          engagementRate: payload.engagementRate,
          postsPerWeek: payload.postsPerWeek,
          isPrimary: payload.isPrimary,
          notes: payload.notes,
          topContent: payload.topContent ?? null,
          observedStrategy: payload.observedStrategy ?? null,
          strengths: payload.strengths,
          weaknesses: payload.weaknesses,
          updateHistory: payload.updateHistory,
        })
        .returning();

      res.status(201).json(serializeCompetitor(row));
    } catch (err) {
      logger.error(
        { err, clientId: ctx.clientId },
        "Create client competitor error",
      );
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

router.patch(
  "/:clientId/competitors/:competitorId",
  validate(updateCompetitorSchema),
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      const payload = req.body as z.infer<typeof updateCompetitorSchema>;
      const [row] = await db
        .update(clientCompetitorsTable)
        .set({
          ...payload,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clientCompetitorsTable.id, req.params.competitorId as string),
            eq(clientCompetitorsTable.clientId, ctx.clientId),
          ),
        )
        .returning();

      if (!row) {
        res.status(404).json({ error: "COMPETITOR_NOT_FOUND" });
        return;
      }

      res.json(serializeCompetitor(row));
    } catch (err) {
      logger.error(
        { err, clientId: ctx.clientId, competitorId: req.params.competitorId },
        "Update client competitor error",
      );
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

router.delete(
  "/:clientId/competitors/:competitorId",
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      await db
        .delete(clientCompetitorsTable)
        .where(
          and(
            eq(clientCompetitorsTable.id, req.params.competitorId as string),
            eq(clientCompetitorsTable.clientId, ctx.clientId),
          ),
        );
      res.status(204).end();
    } catch (err) {
      logger.error(
        { err, clientId: ctx.clientId, competitorId: req.params.competitorId },
        "Delete client competitor error",
      );
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

export default router;
