import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, teamClientAccessTable, teamMembersTable, clientsTable } from "@workspace/db";
import { getUserId, isEnvAdmin } from "../lib/access-control";

const router: IRouter = Router();

router.get("/team-client-access", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Solo gli amministratori possono gestire gli accessi" });
    return;
  }

  const rows = await db.select({
    id: teamClientAccessTable.id,
    teamMemberId: teamClientAccessTable.teamMemberId,
    clientId: teamClientAccessTable.clientId,
    createdAt: teamClientAccessTable.createdAt,
  }).from(teamClientAccessTable);

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.get("/team-client-access/:teamMemberId", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Solo gli amministratori possono visualizzare gli accessi" });
    return;
  }

  const teamMemberId = parseInt(req.params.teamMemberId);
  if (isNaN(teamMemberId)) {
    res.status(400).json({ error: "ID membro non valido" });
    return;
  }

  const rows = await db.select({
    id: teamClientAccessTable.id,
    teamMemberId: teamClientAccessTable.teamMemberId,
    clientId: teamClientAccessTable.clientId,
    clientName: clientsTable.name,
    createdAt: teamClientAccessTable.createdAt,
  })
    .from(teamClientAccessTable)
    .leftJoin(clientsTable, eq(teamClientAccessTable.clientId, clientsTable.id))
    .where(eq(teamClientAccessTable.teamMemberId, teamMemberId));

  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.put("/team-client-access/:teamMemberId", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Solo gli amministratori possono gestire gli accessi" });
    return;
  }

  const teamMemberId = parseInt(req.params.teamMemberId);
  if (isNaN(teamMemberId)) {
    res.status(400).json({ error: "ID membro non valido" });
    return;
  }

  const { clientIds } = req.body as { clientIds: number[] };
  if (!Array.isArray(clientIds)) {
    res.status(400).json({ error: "clientIds deve essere un array" });
    return;
  }

  await db.delete(teamClientAccessTable).where(eq(teamClientAccessTable.teamMemberId, teamMemberId));

  if (clientIds.length > 0) {
    await db.insert(teamClientAccessTable).values(
      clientIds.map((clientId) => ({
        teamMemberId,
        clientId,
        grantedBy: userId,
      }))
    );
  }

  const updated = await db.select({
    id: teamClientAccessTable.id,
    teamMemberId: teamClientAccessTable.teamMemberId,
    clientId: teamClientAccessTable.clientId,
    clientName: clientsTable.name,
    createdAt: teamClientAccessTable.createdAt,
  })
    .from(teamClientAccessTable)
    .leftJoin(clientsTable, eq(teamClientAccessTable.clientId, clientsTable.id))
    .where(eq(teamClientAccessTable.teamMemberId, teamMemberId));

  res.json(updated.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

export default router;
