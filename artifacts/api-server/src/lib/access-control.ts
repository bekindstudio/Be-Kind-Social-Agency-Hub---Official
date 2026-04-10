import { db, teamMembersTable, teamClientAccessTable, userRoles } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

/**
 * Se true, l’API accetta richieste senza Bearer JWT e usa un utente sintetico
 * con privilegi massimi (solo ambienti fidati / demo).
 */
export function isApiAuthBypass(): boolean {
  const v = process.env.API_AUTH_DISABLED;
  return v === "true" || v === "1";
}

/** ID sintetico quando `API_AUTH_DISABLED` è attivo. */
export function getAnonymousApiUserId(): string {
  return (process.env.API_ANONYMOUS_CLERK_USER_ID ?? "__api_anonymous__").trim() || "__api_anonymous__";
}

function getAdminIds(): Set<string> {
  const merged = [process.env.ADMIN_CLERK_USER_IDS ?? "", process.env.ADMIN_SUPABASE_USER_IDS ?? ""].join(",");
  return new Set(merged.split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * Identità principale: JWT Supabase (`sub`) dopo `supabaseAuthMiddleware`, oppure bypass anonimo.
 * Il campo `team_members.clerk_user_id` / `user_roles.clerk_user_id` può contenere lo stesso UUID Supabase.
 */
export function getUserId(req: Request): string | null {
  if (isApiAuthBypass()) return getAnonymousApiUserId();
  const sid = req.supabaseUserId;
  if (sid) return sid;
  return null;
}

export function isEnvAdmin(userId: string | null): boolean {
  if (!userId) return false;
  if (isApiAuthBypass()) return true;
  return getAdminIds().has(userId);
}

export async function getAccessibleClientIds(userId: string): Promise<number[] | "all"> {
  if (isEnvAdmin(userId)) return "all";

  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.clerkUserId, userId));
  if (roleRow?.role === "admin") return "all";

  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.clerkUserId, userId));
  if (!member) return [];

  const accessRows = await db.select().from(teamClientAccessTable).where(eq(teamClientAccessTable.teamMemberId, member.id));

  if (accessRows.length === 0) return "all";

  return accessRows.map((r) => r.clientId);
}

export function filterByClientAccess<T extends { clientId?: number | null }>(
  items: T[],
  accessibleClientIds: number[] | "all"
): T[] {
  if (accessibleClientIds === "all") return items;
  return items.filter((item) => {
    if (!item.clientId) return true;
    return accessibleClientIds.includes(item.clientId);
  });
}
