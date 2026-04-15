import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, clientPostsTable } from "@workspace/db";
import { getAccessibleClientIds, getUserId } from "../lib/access-control";
import { logger } from "../lib/logger";
import { validate } from "../middlewares/validate";

const router = Router();

const postPlatformSchema = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "x",
  "youtube",
]);
const postStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "published",
  "rejected",
]);

const createPostSchema = z.object({
  title: z.string().trim().min(1).max(500),
  caption: z.string().default(""),
  platform: postPlatformSchema,
  status: postStatusSchema.default("draft"),
  scheduledDate: z.string().datetime().optional().nullable(),
  mediaUrls: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  internalNotes: z.string().optional().nullable(),
});

const updatePostSchema = createPostSchema.partial();

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

function serializePost(row: typeof clientPostsTable.$inferSelect) {
  return {
    ...row,
    scheduledDate: row.scheduledDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/:clientId/posts", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req, res);
  if (!ctx) return;

  try {
    const rows = await db
      .select()
      .from(clientPostsTable)
      .where(eq(clientPostsTable.clientId, ctx.clientId))
      .orderBy(desc(clientPostsTable.scheduledDate), desc(clientPostsTable.createdAt));
    res.json(rows.map(serializePost));
  } catch (err) {
    logger.error({ err, clientId: ctx.clientId }, "Get client posts error");
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

router.post(
  "/:clientId/posts",
  validate(createPostSchema),
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      const payload = req.body as z.infer<typeof createPostSchema>;
      const [row] = await db
        .insert(clientPostsTable)
        .values({
          clientId: ctx.clientId,
          title: payload.title,
          caption: payload.caption,
          platform: payload.platform,
          status: payload.status,
          scheduledDate: payload.scheduledDate
            ? new Date(payload.scheduledDate)
            : null,
          mediaUrls: payload.mediaUrls,
          hashtags: payload.hashtags,
          internalNotes: payload.internalNotes ?? null,
        })
        .returning();

      res.status(201).json(serializePost(row));
    } catch (err) {
      logger.error({ err, clientId: ctx.clientId }, "Create client post error");
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

router.patch(
  "/:clientId/posts/:postId",
  validate(updatePostSchema),
  async (req, res): Promise<void> => {
    const ctx = await ensureClientAccess(req, res);
    if (!ctx) return;

    try {
      const payload = req.body as z.infer<typeof updatePostSchema>;
      const [row] = await db
        .update(clientPostsTable)
        .set({
          ...payload,
          scheduledDate:
            payload.scheduledDate === undefined
              ? undefined
              : payload.scheduledDate
                ? new Date(payload.scheduledDate)
                : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clientPostsTable.id, req.params.postId as string),
            eq(clientPostsTable.clientId, ctx.clientId),
          ),
        )
        .returning();

      if (!row) {
        res.status(404).json({ error: "POST_NOT_FOUND" });
        return;
      }

      res.json(serializePost(row));
    } catch (err) {
      logger.error(
        { err, clientId: ctx.clientId, postId: req.params.postId },
        "Update client post error",
      );
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  },
);

router.delete("/:clientId/posts/:postId", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req, res);
  if (!ctx) return;

  try {
    await db
      .delete(clientPostsTable)
      .where(
        and(
          eq(clientPostsTable.id, req.params.postId as string),
          eq(clientPostsTable.clientId, ctx.clientId),
        ),
      );
    res.status(204).end();
  } catch (err) {
    logger.error(
      { err, clientId: ctx.clientId, postId: req.params.postId },
      "Delete client post error",
    );
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

export default router;
