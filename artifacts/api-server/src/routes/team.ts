import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";
import { isRequestAdmin } from "../lib/request-admin";
import { getSupabaseAdmin, portalPublicOrigin } from "../lib/supabaseAdmin";

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
  const b = req.body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  const name = str("name");
  const email = str("email");
  const authUserId =
    (typeof b.authUserId === "string" && b.authUserId.trim()) ||
    (typeof b.clerkUserId === "string" && b.clerkUserId.trim()) ||
    null;
  if (!name || !email) { res.status(400).json({ error: "Nome e email sono obbligatori" }); return; }
  const [member] = await db.insert(teamMembersTable).values({
    name,
    surname: str("surname") || "",
    email,
    phone: str("phone") || "",
    role: str("role") || "Collaboratore",
    department: str("department") || "",
    birthDate: (typeof b.birthDate === "string" && b.birthDate) || null,
    hireDate: (typeof b.hireDate === "string" && b.hireDate) || null,
    photoUrl: str("photoUrl") || "",
    avatarColor: str("avatarColor") || "#6366f1",
    linkedin: str("linkedin") || "",
    notes: str("notes") || "",
    authUserId: authUserId || null,
  }).returning();
  res.status(201).json(serializeMember(member));
});

router.patch("/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const allowedFields = ["name", "surname", "email", "phone", "role", "department", "birthDate", "hireDate", "photoUrl", "avatarColor", "linkedin", "notes", "isActive", "authUserId", "clerkUserId"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  if (updates.clerkUserId !== undefined && updates.authUserId === undefined) {
    updates.authUserId = updates.clerkUserId;
    delete updates.clerkUserId;
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

/** Invio email invito Supabase: solo se il membro esiste in team (email già censita dall’admin). */
router.post("/team/:id/supabase-invite", async (req, res): Promise<void> => {
  if (!(await isRequestAdmin(req))) {
    res.status(403).json({ error: "Solo un amministratore può inviare inviti" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, id));
  if (!member) { res.status(404).json({ error: "Membro non trovato" }); return; }
  const email = member.email?.trim();
  if (!email) { res.status(400).json({ error: "Email mancante" }); return; }
  let supa;
  try {
    supa = getSupabaseAdmin();
  } catch (e) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Server di invito non configurato" });
    return;
  }
  const origin = portalPublicOrigin();
  const redirectTo = `${origin}/auth/callback`;
  const { error } = await supa.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

export default router;
