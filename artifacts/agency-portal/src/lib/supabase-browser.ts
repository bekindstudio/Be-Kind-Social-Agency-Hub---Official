import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { portalFetch } from "@workspace/api-client-react";

let client: SupabaseClient | null = null;
let resolvedUrl: string | null = null;
let resolvedAnon: string | null = null;

function viteUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL?.trim() || undefined;
}

/** Anon / “publishable” (dashboard Supabase recente): stesso uso per createClient lato browser. */
function viteAnon(): string | undefined {
  return (
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
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
    const r = await portalFetch("/api/public/supabase-config");
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
    throw new Error(
      "Mancano URL e chiave anon/publishable Supabase. Su Vercel: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (o VITE_SUPABASE_PUBLISHABLE_KEY). Su Render: PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY (o …_PUBLISHABLE_KEY / SUPABASE_ANON_KEY).",
    );
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
