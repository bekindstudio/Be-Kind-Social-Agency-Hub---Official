-- Be Kind HUB · Migration: agenda personale utente
-- Da applicare su Supabase: SQL Editor → incolla → Run. Idempotente.
--
-- Tabella PRIVATA all'utente che la crea: ogni record ha user_id (testo
-- corrispondente a auth.uid()). Non condivisa con il team. Usata per
-- appuntamenti personali (call, meeting interno, in-sede cliente/ufficio).

CREATE TABLE IF NOT EXISTS personal_agenda_events (
  id           serial PRIMARY KEY,
  user_id      text NOT NULL,
  title        text NOT NULL,
  type         text NOT NULL,
  start_at     timestamptz NOT NULL,
  end_at       timestamptz,
  location     text,
  notes        text,
  attendees    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Vincolo soft sul type (la app valida con Zod, qui ci difendiamo da insert diretti).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personal_agenda_events_type_check'
  ) THEN
    ALTER TABLE personal_agenda_events
      ADD CONSTRAINT personal_agenda_events_type_check
      CHECK (type IN ('call', 'meeting', 'in_sede'));
  END IF;
END $$;

-- Index per la query principale: i miei eventi ordinati per data.
CREATE INDEX IF NOT EXISTS idx_personal_agenda_user_start
  ON personal_agenda_events (user_id, start_at);

-- RLS: ogni utente vede SOLO i propri eventi. A differenza delle altre
-- tabelle dove l'ACL è applicativa, qui la security è anche a livello DB.
ALTER TABLE personal_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_agenda_events owner only" ON personal_agenda_events;
CREATE POLICY "personal_agenda_events owner only"
  ON personal_agenda_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
