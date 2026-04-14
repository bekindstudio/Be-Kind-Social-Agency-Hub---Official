import { Router, type Request, type Response } from "express";
import { db, notifications } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getUserId, isAnonymousApiUserId, isApiAuthBypass } from "../lib/access-control";

const router = Router();

function requireNotificationUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  // Con API_AUTH_DISABLED il portale usa un id sintetico: le query ritornano liste vuote invece di 401.
  if (isAnonymousApiUserId(userId) && isApiAuthBypass()) {
    return userId;
  }
  if (isAnonymousApiUserId(userId)) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  return userId;
}

router.get("/notifications", async (req: Request, res: Response): Promise<void> => {
  const userId = requireNotificationUser(req, res);
  if (!userId) return;
  const rows = await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  res.json(rows);
});

router.get("/notifications/unread-count", async (req: Request, res: Response): Promise<void> => {
  const userId = requireNotificationUser(req, res);
  if (!userId) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  res.json({ count: Number(row?.count ?? 0) });
});

router.patch("/notifications/:id/read", async (req: Request, res: Response): Promise<void> => {
  const userId = requireNotificationUser(req, res);
  if (!userId) return;
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Non trovata" }); return; }
  res.json(row);
});

router.post("/notifications/read-all", async (req: Request, res: Response): Promise<void> => {
  const userId = requireNotificationUser(req, res);
  if (!userId) return;
  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  res.json({ success: true });
});

router.delete("/notifications/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = requireNotificationUser(req, res);
  if (!userId) return;
  const id = parseInt(req.params.id as string);
  await db.delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  res.sendStatus(204);
});

export default router;
