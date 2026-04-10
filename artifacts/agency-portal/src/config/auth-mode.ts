/**
 * Default: portal senza login (tutte le pagine accessibili).
 * Per riattivare Supabase: su Vercel imposta `VITE_AUTH_ENABLED=true` e ridistribuisci.
 *
 * Su Render, `API_AUTH_DISABLED=true` consente ancora richieste senza JWT per demo/strumenti,
 * ma se il client invia `Authorization: Bearer <access_token>` il middleware verifica il JWT
 * e usa il `sub` reale (necessario per notifiche e dati per-utente). Imposta `SUPABASE_JWT_SECRET`
 * uguale al JWT Secret del progetto Supabase. Per produzione stretta puoi usare `API_AUTH_DISABLED=false`.
 */
export const AUTH_DISABLED =
  import.meta.env.VITE_AUTH_ENABLED !== "true" && import.meta.env.VITE_AUTH_ENABLED !== "1";
