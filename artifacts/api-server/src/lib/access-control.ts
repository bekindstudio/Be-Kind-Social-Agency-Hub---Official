import { db, teamMembersTable, teamClientAccessTable, userRoles } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

/**
 * Se true, l’API accetta richieste senza Bearer JWT e usa un utente sintetico
 * con privilegi massimi (solo ambienti fidati / demo).
 */
export function isApiAuthBypass(): boolean {
  return process.env.API_AUTH_DISABLED === "true";
}

/** ID sintetico quando `API_AUTH_DISABLED` è attivo. */
export function getAnonymousApiUserId(): string {
  return (
    (process.env.API_ANONYMOUS_USER_ID ?? process.env.API_ANONYMOUS_CLERK_USER_ID ?? "__api_anonymous__").trim() ||
    "__api_anonymous__"
  );
}

function getAdminIds(): Set<string> {
  const merged = [
    process.env.ADMIN_SUPABASE_USER_IDS ?? "",
    process.env.ADMIN_AUTH_USER_IDS ?? "",
    process.env.ADMIN_CLERK_USER_IDS ?? "",
  ].join(",");
  return new Set(merged.split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * Identità: prima il JWT Supabase (`sub`) se il middleware ha valorizzato `req.supabaseUserId`;
 * solo se manca e `API_AUTH_DISABLED` è attivo → utente sintetico per compat demo/server.
 * Così con Bearer + bypass si ottiene l’UUID reale, non `__api_anonymous__`.
 */
export function getUserId(req: Request): string | null {
  const sid = req.supabaseUserId;
  if (sid) return sid;
  if (isApiAuthBypass()) return getAnonymousApiUserId();
  return null;
}

/** True se l’ID è il placeholder usato solo senza JWT in modalità bypass. */
export function isAnonymousApiUserId(userId: string | null | undefined): boolean {
  if (userId == null || userId === "") return false;
  return userId === getAnonymousApiUserId();
}

export function isEnvAdmin(userId: string | null): boolean {
  if (!userId) return false;
  if (isApiAuthBypass()) return true;
  return getAdminIds().has(userId);
}

export async function getAccessibleClientIds(userId: string): Promise<number[] | "all"> {
  if (isEnvAdmin(userId)) return "all";

  const [roleRow] = await db.select().from(userRoles).where(eq(userRoles.authUserId, userId));
  if (roleRow?.role === "admin") return "all";

  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.authUserId, userId));
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
