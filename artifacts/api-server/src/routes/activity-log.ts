import { Router, type IRouter } from "express";
import { db, activityLog } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { getUserId } from "../lib/access-control";
import { z } from "zod";

const router: IRouter = Router();

router.get("/activity-log", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const rows = await db.select().from(activityLog)
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

const logSchema = z.object({
  action: z.string(),
  entityType: z.string(),
  entityId: z.number().optional(),
  entityName: z.string().optional(),
  details: z.string().optional(),
});

router.post("/activity-log", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const row = await db.insert(activityLog).values({
    userId,
    userName: (req as any).auth?.sessionClaims?.fullName ?? null,
    ...parsed.data,
  }).returning();

  res.status(201).json(row[0]);
});

export default router;

export async function logActivity(opts: {
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: number;
  entityName?: string;
  details?: string;
}) {
  try {
    await db.insert(activityLog).values(opts);
  } catch {}
}
