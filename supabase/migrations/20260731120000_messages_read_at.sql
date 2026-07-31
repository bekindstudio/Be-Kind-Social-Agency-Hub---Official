-- Wave DD — pallino "messaggi non letti" per l'agenzia.
--
-- Quando l'agenzia legge la chat di un cliente, i messaggi del cliente vengono
-- timbrati come letti. I "non letti" = messaggi source='client' con read_at NULL.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Indice per il conteggio veloce dei non letti per cliente.
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (client_id)
  WHERE source = 'client' AND read_at IS NULL AND client_id IS NOT NULL;
