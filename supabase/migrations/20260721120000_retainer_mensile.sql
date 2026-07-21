-- Wave CR — il retainer mensile come ciclo, non come lavoro da ricordarsi.
--
-- Due pezzi indipendenti ma della stessa storia:
--  1. ore incluse nel canone → si può finalmente dire se un cliente rende o costa
--  2. client_retainer_tasks → il lavoro ricorrente del mese si rigenera da solo

-- 1. ORE INCLUSE NEL CANONE ---------------------------------------------------
-- valore_mensile (€) esisteva già; senza le ore incluse è un numero solo, non
-- confrontabile con le ore davvero lavorate.
ALTER TABLE client_billing
  ADD COLUMN IF NOT EXISTS ore_incluse integer;

COMMENT ON COLUMN client_billing.ore_incluse IS
  'Ore/mese comprese nel canone. NULL = retainer senza monte ore concordato.';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_billing_ore_incluse_check') THEN
    ALTER TABLE client_billing
      ADD CONSTRAINT client_billing_ore_incluse_check
      CHECK (ore_incluse IS NULL OR ore_incluse > 0);
  END IF;
END $$;

-- 2. TASK RICORRENTI DEL RETAINER ---------------------------------------------
-- Il modello: qui sta il MODELLO del lavoro mensile (una riga per "cosa si fa
-- ogni mese"), non le task vere. Il job del 1° del mese le materializza in
-- `tasks`. Così cambiare il retainer di un cliente non tocca lo storico.
CREATE TABLE IF NOT EXISTS client_retainer_tasks (
  id serial PRIMARY KEY,
  client_id integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  categoria text,
  -- Giorno del mese in cui la task deve comparire. 1-28: oltre il 28 non esiste
  -- in febbraio e servirebbe una regola di clamp che nessuno ricorderebbe.
  day_of_month integer NOT NULL DEFAULT 1,
  estimated_hours integer,
  priority text NOT NULL DEFAULT 'medium',
  assignee_id integer,
  -- Disattivare invece di cancellare: un retainer sospeso torna spesso.
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_retainer_tasks_day_check') THEN
    ALTER TABLE client_retainer_tasks
      ADD CONSTRAINT client_retainer_tasks_day_check
      CHECK (day_of_month BETWEEN 1 AND 28);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS client_retainer_tasks_client_idx
  ON client_retainer_tasks (client_id) WHERE active;

-- Convenzione di progetto: RLS attiva e ZERO policy — l'API accede col ruolo
-- postgres e fa da sola i controlli per cliente. (client_notes è l'eccezione
-- storica da non imitare.)
ALTER TABLE client_retainer_tasks ENABLE ROW LEVEL SECURITY;

-- 3. TRACCIA DELLA MATERIALIZZAZIONE ------------------------------------------
-- Serve per l'idempotenza del job: rilanciarlo a mano non deve duplicare le
-- task. Sta sulla task e non in una tabella a parte perché la domanda è sempre
-- "questa task di che mese di retainer è?".
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS retainer_task_id integer,
  ADD COLUMN IF NOT EXISTS retainer_period text;

COMMENT ON COLUMN tasks.retainer_period IS
  'Mese di retainer che ha generato la task, formato YYYY-MM. NULL = task normale.';

-- L'unicità è ciò che rende il job rilanciabile senza paura.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_retainer_unique_idx
  ON tasks (retainer_task_id, retainer_period)
  WHERE retainer_task_id IS NOT NULL;
