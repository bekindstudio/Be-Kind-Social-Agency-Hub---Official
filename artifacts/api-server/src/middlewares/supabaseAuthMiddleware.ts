import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { isApiAuthBypass } from "../lib/access-control";
import { linkTeamMemberToSupabaseUser } from "../lib/team-supabase-link";

function getSupabaseJwtSecret(): Uint8Array | null {
  const raw = process.env.SUPABASE_JWT_SECRET;
  if (!raw?.trim()) return null;
  return new TextEncoder().encode(raw.trim());
}

/**
 * Legge `Authorization: Bearer <access_token>` (JWT Supabase), verifica con
 * `SUPABASE_JWT_SECRET` e imposta `req.supabaseUserId` = claim `sub`.
 */
export const supabaseAuthMiddleware: RequestHandler = async (req, _res, next) => {
  if (isApiAuthBypass()) {
    next();
    return;
  }

  const secret = getSupabaseJwtSecret();
  if (!secret) {
    req.supabaseUserId = null;
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    req.supabaseUserId = null;
    next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    req.supabaseUserId = null;
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    req.supabaseUserId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (req.supabaseUserId && email) {
      await linkTeamMemberToSupabaseUser(req.supabaseUserId, email);
    }
  } catch {
    req.supabaseUserId = null;
  }

  next();
};
