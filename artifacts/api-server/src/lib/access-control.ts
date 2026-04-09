import { db, teamMembersTable, teamClientAccessTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { getAuth } from "@clerk/express";

function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_CLERK_USER_IDS ?? "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export function getUserId(req: Request): string | null {
  try {
    const auth = getAuth(req as any);
    return auth?.userId ?? null;
  } catch {
    return null;
  }
}

export function isEnvAdmin(userId: string | null): boolean {
  if (!userId) return false;
  return getAdminIds().has(userId);
}

export async function getAccessibleClientIds(userId: string): Promise<number[] | "all"> {
  if (isEnvAdmin(userId)) return "all";

  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.clerkUserId, userId));
  if (!member) return "all";

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
