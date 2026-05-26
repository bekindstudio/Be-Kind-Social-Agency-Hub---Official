/**
 * Login Supabase SEMPRE richiesto.
 *
 * Il portale è privato: ogni pagina richiede una sessione Supabase valida
 * (email + password). Non esiste più un interruttore di build `VITE_AUTH_ENABLED`
 * — la configurazione Supabase (URL + chiave anon) arriva a runtime da
 * `/api/public/supabase-config`, coerente col resto del progetto (nessuna
 * `VITE_*` nel bundle del frontend).
 *
 * Lato API il gate resta `API_AUTH_DISABLED` (default false → JWT obbligatorio);
 * in produzione l'avvio viene bloccato se messo a `true`.
 */
export const AUTH_DISABLED = false;
