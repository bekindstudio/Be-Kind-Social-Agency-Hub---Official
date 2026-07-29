-- Wave DC — chat cliente↔agenzia dentro il portale (per togliere WhatsApp).
--
-- Riusa la tabella messages aggiungendo il filo diretto col cliente:
--  client_id = di quale cliente è la conversazione (NULL = messaggio team/progetto)
--  source    = 'agency' | 'client', per allineare le bolle nella chat
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS client_id integer,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'agency';

CREATE INDEX IF NOT EXISTS messages_client_idx ON messages (client_id, created_at)
  WHERE client_id IS NOT NULL;
