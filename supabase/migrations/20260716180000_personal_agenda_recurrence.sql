-- Be Kind HUB · Migration: appuntamenti ricorrenti in agenda personale
-- Da applicare su Supabase: SQL Editor → incolla → Run. Idempotente.
--
-- Una serie ricorrente resta UNA riga sola: le occorrenze non si materializzano
-- nel DB, le calcola l'API al volo (routes/personal-agenda.ts). Così spostare o
-- rinominare la serie è un UPDATE solo, e non restano centinaia di righe orfane
-- se la si cancella.

ALTER TABLE personal_agenda_events
  ADD COLUMN IF NOT EXISTS recurrence text;

ALTER TABLE personal_agenda_events
  ADD COLUMN IF NOT EXISTS recurrence_until timestamptz;

-- Occorrenze saltate ("elimina solo questa"): elenco di istanti di inizio da
-- non generare. Confrontati sull'istante esatto dell'occorrenza calcolata.
ALTER TABLE personal_agenda_events
  ADD COLUMN IF NOT EXISTS recurrence_exceptions timestamptz[] NOT NULL DEFAULT '{}';

-- recurrence NULL = evento singolo (tutti quelli già esistenti restano tali).
-- 'weekly' = ogni settimana nello stesso giorno/ora di start_at.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personal_agenda_events_recurrence_check') THEN
    ALTER TABLE personal_agenda_events
      ADD CONSTRAINT personal_agenda_events_recurrence_check
      CHECK (recurrence IS NULL OR recurrence IN ('weekly'));
  END IF;
END $$;

-- Una data di fine senza ricorrenza non significa niente: meglio bloccarla qui
-- che ritrovarsi dati incoerenti da capire fra sei mesi.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personal_agenda_events_recurrence_until_check') THEN
    ALTER TABLE personal_agenda_events
      ADD CONSTRAINT personal_agenda_events_recurrence_until_check
      CHECK (recurrence_until IS NULL OR recurrence IS NOT NULL);
  END IF;
END $$;

-- Nessun index nuovo: l'index (user_id, start_at) esistente copre già la query,
-- e le serie ricorrenti sono poche righe che vengono espanse in memoria.
