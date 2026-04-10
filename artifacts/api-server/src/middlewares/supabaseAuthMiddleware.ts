import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { linkTeamMemberToSupabaseUser } from "../lib/team-supabase-link";

function getSupabaseJwtSecret(): Uint8Array | null {
  const raw = process.env.SUPABASE_JWT_SECRET;
  if (!raw?.trim()) return null;
  return new TextEncoder().encode(raw.trim());
}

function debugAuthLog(req: { method?: string; path?: string; headers: { authorization?: string } }, msg: string, extra?: Record<string, unknown>) {
  if (process.env.DEBUG_API_AUTH !== "true" && process.env.DEBUG_API_AUTH !== "1") return;
  const auth = req.headers.authorization;
  const hasAuth = Boolean(auth);
  const looksBearer = Boolean(auth?.startsWith("Bearer "));
  // eslint-disable-next-line no-console
  console.info("[DEBUG_API_AUTH]", msg, {
    method: req.method,
    path: req.path,
    hasAuthorizationHeader: hasAuth,
    bearerPrefix: looksBearer,
    ...extra,
  });
}

/**
 * Verifica sempre il JWT Supabase se sono presenti `Authorization: Bearer` e
 * `SUPABASE_JWT_SECRET`, anche con `API_AUTH_DISABLED=true`. Così Vercel → Render
 * può propagare il token e `req.supabaseUserId` = `sub` reale.
 * Senza Bearer, il bypass anonimo è gestito da `getUserId` in access-control.
 */
export const supabaseAuthMiddleware: RequestHandler = async (req, _res, next) => {
  req.supabaseUserId = null;

  const secret = getSupabaseJwtSecret();
  if (!secret) {
    debugAuthLog(req, "no SUPABASE_JWT_SECRET; skipping JWT verify");
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    debugAuthLog(req, "no Bearer token");
    next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    debugAuthLog(req, "empty Bearer token");
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    req.supabaseUserId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    debugAuthLog(req, "jwt verified", { supabaseUserId: req.supabaseUserId ?? null });
    if (req.supabaseUserId && email) {
      await linkTeamMemberToSupabaseUser(req.supabaseUserId, email);
    }
  } catch {
    debugAuthLog(req, "jwt verify failed");
    req.supabaseUserId = null;
  }

  next();
};
