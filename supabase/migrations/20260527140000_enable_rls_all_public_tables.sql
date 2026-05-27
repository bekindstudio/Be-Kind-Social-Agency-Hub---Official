-- SICUREZZA CRITICA: abilita Row Level Security su TUTTE le tabelle public.
--
-- Senza RLS, la anon key (pubblica, servita da /api/public/supabase-config)
-- permetteva di leggere/scrivere l'intero DB via PostgREST
-- (https://<project>.supabase.co/rest/v1/<table>), bypassando del tutto
-- l'autenticazione a livello di API. Confermato: GET clients?select=iban
-- ritornava i dati con la sola anon key.
--
-- L'API si connette come ruolo `postgres` (rolbypassrls = true, owner delle
-- tabelle) quindi NON è impattata: RLS abilitata senza policy = deny-all per
-- anon/authenticated, accesso pieno per l'API. Reversibile con DISABLE.
--
-- NB: ogni NUOVA tabella creata via Drizzle nasce SENZA RLS → ricordarsi di
-- abilitarla (o ri-eseguire questo blocco) dopo nuove migrazioni.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
