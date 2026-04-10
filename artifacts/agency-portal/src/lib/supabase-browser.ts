import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let resolvedUrl: string | null = null;
let resolvedAnon: string | null = null;

function viteUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL?.trim() || undefined;
}

function viteAnon(): string | undefined {
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || undefined;
}

/**
 * Risolve URL + anon key: prima da variabili Vite (build), altrimenti da GET /api/public/supabase-config (Render).
 * Chiamare una volta prima di usare getSupabaseBrowserClient().
 */
export async function initSupabaseFromEnvOrApi(): Promise<boolean> {
  const vUrl = viteUrl();
  const vAnon = viteAnon();
  if (vUrl && vAnon) {
    resolvedUrl = vUrl;
    resolvedAnon = vAnon;
    return true;
  }
  try {
    const r = await fetch("/api/public/supabase-config", { credentials: "include" });
    if (!r.ok) return false;
    const j = (await r.json()) as { url?: string; anonKey?: string };
    const url = j.url?.trim();
    const anon = j.anonKey?.trim();
    if (!url || !anon) return false;
    resolvedUrl = url;
    resolvedAnon = anon;
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  const url = resolvedUrl ?? viteUrl();
  const anon = resolvedAnon ?? viteAnon();
  if (!url?.trim() || !anon?.trim()) {
    throw new Error("Mancano URL e anon key Supabase. Configura VITE_SUPABASE_* su Vercel oppure PUBLIC_SUPABASE_* / SUPABASE_ANON_KEY su Render.");
  }
  client = createClient(url.trim(), anon.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
