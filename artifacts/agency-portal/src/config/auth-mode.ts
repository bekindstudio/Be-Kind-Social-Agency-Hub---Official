/**
 * Default: portal senza login (tutte le pagine accessibili).
 * Per riattivare Supabase: su Vercel imposta `VITE_AUTH_ENABLED=true` e ridistribuisci.
 *
 * Su Render l’API deve avere `API_AUTH_DISABLED=true` così le chiamate `/api/*` funzionano senza Bearer JWT.
 */
export const AUTH_DISABLED =
  import.meta.env.VITE_AUTH_ENABLED !== "true" && import.meta.env.VITE_AUTH_ENABLED !== "1";
