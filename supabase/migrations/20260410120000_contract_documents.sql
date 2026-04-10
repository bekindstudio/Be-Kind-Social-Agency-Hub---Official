-- Estende template contratti e crea tabella contratti generati (documenti da template).
-- Nota: la tabella legacy `contracts` resta per i contratti legati ai clienti (client-contracts).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS variables JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL,
  template_id INTEGER REFERENCES contract_templates(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_vat TEXT,
  client_address TEXT,
  service_type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'bozza',
  value NUMERIC(14, 2),
  start_date DATE,
  end_date DATE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_documents_status ON contract_documents(status);
CREATE INDEX IF NOT EXISTS idx_contract_documents_service_type ON contract_documents(service_type);
CREATE INDEX IF NOT EXISTS idx_contract_documents_created_at ON contract_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_contract_documents_end_date ON contract_documents(end_date);
