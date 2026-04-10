-- Soft delete: deleted_at + tabella trash_log
-- Esegui su Supabase (SQL Editor) o: pnpm run db:push

CREATE TABLE IF NOT EXISTS trash_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  record_label text,
  deleted_by text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trash_log_deleted_at ON trash_log (deleted_at);
CREATE INDEX IF NOT EXISTS idx_trash_log_table_record ON trash_log (table_name, record_id);

-- Tabelle portale (deleted_at nullable = attivo)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE contract_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE quote_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE content_categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE editorial_plans ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE editorial_slots ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE editorial_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- updated_at: già presente su quasi tutte; editorial_templates non ce l'ha in alcuni DB
ALTER TABLE editorial_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
