-- Be Kind HUB · Migration: tabella client_content_ideas (banca idee contenuti per cliente)
-- Da applicare su Supabase: SQL Editor → incolla → Run. Idempotente.

CREATE TABLE IF NOT EXISTS client_content_ideas (
  id            serial PRIMARY KEY,
  client_id     integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title         text NOT NULL,
  url           text NOT NULL,
  platform      text NOT NULL DEFAULT 'web',
  source        text NOT NULL DEFAULT 'agency',
  status        text NOT NULL DEFAULT 'da_valutare',
  notes         text,
  tags          text[] NOT NULL DEFAULT '{}',
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index per la query principale: tutte le idee di un cliente, più recenti prima.
CREATE INDEX IF NOT EXISTS idx_client_content_ideas_client
  ON client_content_ideas (client_id, created_at DESC);

-- CHECK: la validazione vera è Zod nella route; questi vincoli difendono solo
-- da insert diretti (SQL Editor / script). `platform` non ha CHECK: è derivata
-- dall'hostname ed è volutamente aperta a nuove piattaforme senza migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_content_ideas_source_check') THEN
    ALTER TABLE client_content_ideas
      ADD CONSTRAINT client_content_ideas_source_check
      CHECK (source IN ('agency', 'client'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_content_ideas_status_check') THEN
    ALTER TABLE client_content_ideas
      ADD CONSTRAINT client_content_ideas_status_check
      CHECK (status IN ('da_valutare', 'approvata', 'realizzata'));
  END IF;
END $$;

-- RLS abilitata SENZA policy, come per client_briefs/client_posts/client_events
-- e le altre 12 tabelle client_* (verificato su pg_policies).
--
-- Non è una svista: l'API si connette con il ruolo `postgres`, che ha
-- BYPASSRLS, quindi legge/scrive comunque. Il filtro per cliente è applicato
-- lato app (getAccessibleClientIds per l'agenzia, share_token per il cliente).
-- Senza policy, invece, nessuno può leggere questa tabella via PostgREST con un
-- JWT del progetto: è la posizione più chiusa a parità di funzionamento.
-- (client_notes ha una policy permissiva `USING (true)`: è l'eccezione, non il
-- modello — l'advisor Supabase la segnala.)
ALTER TABLE client_content_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_content_ideas all authenticated" ON client_content_ideas;
