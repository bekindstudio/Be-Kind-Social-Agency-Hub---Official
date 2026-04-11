import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, userRoles } from "@workspace/db";
import { getUserId, isApiAuthBypass, isEnvAdmin } from "./access-control";

export async function isRequestAdmin(req: Request): Promise<boolean> {
  if (isApiAuthBypass()) return true;
  const userId = getUserId(req);
  if (!userId) return false;
  if (isEnvAdmin(userId)) return true;
  const [role] = await db.select().from(userRoles).where(eq(userRoles.authUserId, userId));
  return role?.role === "admin";
}
