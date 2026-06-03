-- Be Kind HUB · Migration: tabella client_notes (idee/appunti liberi per cliente)
-- Da applicare su Supabase: SQL Editor → incolla → Run. Idempotente.

CREATE TABLE IF NOT EXISTS client_notes (
  id           serial PRIMARY KEY,
  client_id    integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content      text NOT NULL,
  color        text NOT NULL DEFAULT '#fef3c7',
  pinned       boolean NOT NULL DEFAULT false,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index per la query principale: tutte le note di un cliente, pinned prima poi per data desc
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes (client_id, pinned DESC, created_at DESC);

-- RLS abilitata coerentemente con le altre tabelle. L'app filtra via accessible_client_ids
-- nel backend Express (vedi access-control.ts), quindi la policy qui consente tutto agli
-- utenti autenticati e la security è imposta a livello applicativo.
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_notes all authenticated" ON client_notes;
CREATE POLICY "client_notes all authenticated"
  ON client_notes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
