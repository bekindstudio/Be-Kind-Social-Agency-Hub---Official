-- Wave DP — Contratti nel portale cliente: collegamento al cliente, proposte di
-- modifica e firma elettronica semplice con audit trail.
--
-- 1) contract_documents si aggancia al cliente (client_id) e guadagna i campi
--    di firma: nome digitato, IP, user agent, hash del contenuto firmato,
--    accettazione separata delle clausole vessatorie (doppia firma 1341 c.c.),
--    data di invio al portale. Tutto additivo e nullable: nessun impatto sui
--    documenti esistenti.
ALTER TABLE contract_documents
  ADD COLUMN IF NOT EXISTS client_id integer REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_name text,
  ADD COLUMN IF NOT EXISTS signed_ip text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text,
  ADD COLUMN IF NOT EXISTS signed_hash text,
  ADD COLUMN IF NOT EXISTS vexatious_accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contract_documents_client
  ON contract_documents (client_id);

COMMENT ON COLUMN contract_documents.client_id IS
  'Cliente del portale a cui il contratto è visibile (NULL = non collegato).';
COMMENT ON COLUMN contract_documents.signed_hash IS
  'SHA-256 del content al momento della firma: prova che il testo firmato non è cambiato.';

-- 2) Proposte di modifica del cliente sul contratto, con risposta dell'agenzia.
CREATE TABLE IF NOT EXISTS contract_change_requests (
  id          serial PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  client_id   integer NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'proposta',   -- proposta | accettata | rifiutata
  reply       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_change_requests_contract
  ON contract_change_requests (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_change_requests_client
  ON contract_change_requests (client_id);

-- Convenzione di progetto: RLS attiva e ZERO policy — l'API accede col ruolo
-- postgres e fa da sola i controlli (share token nel portale, auth nel cockpit).
ALTER TABLE contract_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contract_change_requests all authenticated" ON contract_change_requests;

COMMENT ON TABLE contract_change_requests IS
  'Proposte di modifica del cliente sui contratti (dal portale), approvate o rifiutate dall''agenzia.';
