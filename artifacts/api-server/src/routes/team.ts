import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function serializeMember(m: typeof teamMembersTable.$inferSelect) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

router.get("/team", async (_req, res): Promise<void> => {
  const members = await db.select().from(teamMembersTable).orderBy(teamMembersTable.name);
  res.json(members.map(serializeMember));
});

router.get("/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, id));
  if (!member) { res.status(404).json({ error: "Membro non trovato" }); return; }
  res.json(serializeMember(member));
});

router.post("/team", async (req, res): Promise<void> => {
  const { name, surname, email, phone, role, department, birthDate, hireDate, photoUrl, avatarColor, linkedin, notes, clerkUserId } = req.body;
  if (!name || !email) { res.status(400).json({ error: "Nome e email sono obbligatori" }); return; }
  const [member] = await db.insert(teamMembersTable).values({
    name,
    surname: surname ?? "",
    email,
    phone: phone ?? "",
    role: role || "Collaboratore",
    department: department ?? "",
    birthDate: birthDate || null,
    hireDate: hireDate || null,
    photoUrl: photoUrl ?? "",
    avatarColor: avatarColor || "#6366f1",
    linkedin: linkedin ?? "",
    notes: notes ?? "",
    clerkUserId: clerkUserId || null,
  }).returning();
  res.status(201).json(serializeMember(member));
});

router.patch("/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const allowedFields = ["name", "surname", "email", "phone", "role", "department", "birthDate", "hireDate", "photoUrl", "avatarColor", "linkedin", "notes", "isActive", "clerkUserId"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }

  const [member] = await db.update(teamMembersTable).set(updates).where(eq(teamMembersTable.id, id)).returning();
  if (!member) { res.status(404).json({ error: "Membro non trovato" }); return; }
  res.json(serializeMember(member));
});

router.delete("/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [member] = await db.delete(teamMembersTable).where(eq(teamMembersTable.id, id)).returning();
  if (!member) { res.status(404).json({ error: "Membro non trovato" }); return; }
  res.sendStatus(204);
});

export default router;
