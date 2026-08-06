-- Accesso cliente con email + password: il cliente entra con credenziali e
-- viene portato SOLO alla sua area portale (nessun accesso all'agenzia).
--
-- Tabella dedicata (non colonne su clients) così: (a) db.select().from(clients)
-- resta intatto anche prima di applicare questa migration; (b) le credenziali
-- stanno separate dal record cliente. La password è salvata come hash HMAC
-- (mai in chiaro), calcolato dall'API col segreto del server.
CREATE TABLE IF NOT EXISTS client_portal_logins (
  id            serial PRIMARY KEY,
  client_id     integer NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- L'email è la chiave di login: univoca case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_logins_email
  ON client_portal_logins (lower(email));

-- Convenzione di progetto: RLS attiva e ZERO policy — l'API accede col ruolo
-- postgres e fa da sola i controlli. client_notes è l'eccezione da non imitare.
ALTER TABLE client_portal_logins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_portal_logins all authenticated" ON client_portal_logins;

COMMENT ON TABLE client_portal_logins IS
  'Credenziali (email + hash password) per l''accesso del cliente alla SUA area portale. Una riga per cliente.';
