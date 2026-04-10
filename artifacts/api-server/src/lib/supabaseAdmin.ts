import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Client service-role: solo server-side (inviti, admin API). */
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sul server per inviare inviti.");
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export function portalPublicOrigin(): string {
  const explicit = process.env.PORTAL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const first = process.env.FRONTEND_URLS?.split(",")[0]?.trim();
  if (first) return first.replace(/\/$/, "");
  return "http://localhost:5173";
}
