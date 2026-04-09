import { Router, type Request, type Response } from "express";
import { db, userRoles, teamMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

const VALID_ROLES = ["admin", "account_manager", "creative", "viewer"] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  account_manager: "Account Manager",
  creative: "Creativo",
  viewer: "Osservatore",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["clients", "projects", "tasks", "team", "chat", "files", "quotes", "contracts", "reports", "settings", "roles"],
  account_manager: ["clients", "projects", "tasks", "team", "chat", "files", "quotes", "contracts", "reports"],
  creative: ["projects", "tasks", "chat", "files"],
  viewer: ["projects", "tasks", "chat"],
};

function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_CLERK_USER_IDS ?? "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function getUserId(req: Request): string | null {
  try {
    const auth = getAuth(req as any);
    return auth?.userId ?? null;
  } catch {
    return null;
  }
}

async function isRequestAdmin(req: Request): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) return false;
  if (getAdminIds().has(userId)) return true;
  const [role] = await db.select().from(userRoles).where(eq(userRoles.clerkUserId, userId));
  return role?.role === "admin";
}

router.get("/roles", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const isAdm = await isRequestAdmin(req);
  if (!isAdm) { res.status(403).json({ error: "Accesso negato" }); return; }
  const roles = await db.select().from(userRoles);
  res.json({ roles, roleDefinitions: ROLE_LABELS, rolePermissions: ROLE_PERMISSIONS });
});

router.get("/roles/my-role", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  if (getAdminIds().has(userId)) {
    res.json({ role: "admin", permissions: ROLE_PERMISSIONS.admin, label: ROLE_LABELS.admin });
    return;
  }
  const [role] = await db.select().from(userRoles).where(eq(userRoles.clerkUserId, userId));
  const userRole = role?.role ?? "admin";
  res.json({ role: userRole, permissions: ROLE_PERMISSIONS[userRole] ?? ROLE_PERMISSIONS.admin, label: ROLE_LABELS[userRole] ?? "Membro" });
});

router.put("/roles/:clerkUserId", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const isAdm = await isRequestAdmin(req);
  if (!isAdm) { res.status(403).json({ error: "Solo gli amministratori possono gestire i ruoli" }); return; }
  const { role } = req.body;
  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Ruolo non valido. Valori accettati: ${VALID_ROLES.join(", ")}` });
    return;
  }
  const targetUserId = req.params.clerkUserId as string;
  const existing = await db.select().from(userRoles).where(eq(userRoles.clerkUserId, targetUserId));
  if (existing.length > 0) {
    const [updated] = await db.update(userRoles).set({ role }).where(eq(userRoles.clerkUserId, targetUserId)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(userRoles).values({ clerkUserId: targetUserId, role }).returning();
    res.status(201).json(created);
  }
});

router.delete("/roles/:clerkUserId", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const isAdm = await isRequestAdmin(req);
  if (!isAdm) { res.status(403).json({ error: "Accesso negato" }); return; }
  await db.delete(userRoles).where(eq(userRoles.clerkUserId, req.params.clerkUserId as string));
  res.sendStatus(204);
});

export default router;
