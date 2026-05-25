import type { RequestHandler } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { linkTeamMemberToSupabaseUser } from "../lib/team-supabase-link";

/**
 * Verifica il JWT Supabase su ogni richiesta con `Authorization: Bearer`.
 *
 * Supabase firma i token con chiavi ASIMMETRICHE (ES256) esposte via JWKS:
 * verifichiamo con la chiave pubblica scaricata da `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
 * (nessun segreto condiviso necessario). Manteniamo un fallback HS256 con
 * `SUPABASE_JWT_SECRET` per progetti ancora sul segreto legacy.
 *
 * Senza Bearer o senza modo di verificare, `req.supabaseUserId` resta null e il
 * bypass anonimo è gestito da `getUserId` in access-control.
 */
let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getRemoteJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  if (remoteJwks) return remoteJwks;
  const base = process.env.SUPABASE_URL?.trim();
  if (!base) return null;
  remoteJwks = createRemoteJWKSet(
    new URL(`${base.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`),
  );
  return remoteJwks;
}

function getHs256Secret(): Uint8Array | null {
  const raw = process.env.SUPABASE_JWT_SECRET;
  if (!raw?.trim()) return null;
  return new TextEncoder().encode(raw.trim());
}

function debugAuthLog(
  req: { method?: string; path?: string; headers: { authorization?: string } },
  msg: string,
  extra?: Record<string, unknown>,
) {
  if (process.env.DEBUG_API_AUTH !== "true" && process.env.DEBUG_API_AUTH !== "1") return;
  const auth = req.headers.authorization;
  // eslint-disable-next-line no-console
  console.info("[DEBUG_API_AUTH]", msg, {
    method: req.method,
    path: req.path,
    hasAuthorizationHeader: Boolean(auth),
    bearerPrefix: Boolean(auth?.startsWith("Bearer ")),
    ...extra,
  });
}

export const supabaseAuthMiddleware: RequestHandler = async (req, _res, next) => {
  req.supabaseUserId = null;

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

  async function applyVerifiedPayload(payload: Record<string, unknown>): Promise<void> {
    req.supabaseUserId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    debugAuthLog(req, "jwt verified", { supabaseUserId: req.supabaseUserId ?? null });
    if (req.supabaseUserId && email) {
      await linkTeamMemberToSupabaseUser(req.supabaseUserId, email);
    }
  }

  // 1) Asimmetrico via JWKS (default Supabase attuale: ES256)
  const jwks = getRemoteJwks();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, { algorithms: ["ES256", "RS256"] });
      await applyVerifiedPayload(payload);
      next();
      return;
    } catch {
      debugAuthLog(req, "jwks verify failed; trying HS256 fallback");
    }
  }

  // 2) Fallback HS256 (segreto legacy), se configurato
  const secret = getHs256Secret();
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      await applyVerifiedPayload(payload);
    } catch {
      debugAuthLog(req, "hs256 verify failed");
      req.supabaseUserId = null;
    }
  } else if (!jwks) {
    debugAuthLog(req, "no SUPABASE_URL (JWKS) nor SUPABASE_JWT_SECRET; skipping verify");
  }

  next();
};
