-- Brief Sito Web — questionario di discovery per il SITO WEB del cliente.
--
-- Tabella dedicata, distinta da client_briefs (che è il brief social/marketing,
-- ciclo di vita continuo). Il sito è una commessa a sé: una riga per cliente,
-- risposte in parsed_json { sezione: { campo: "valore stringa" } }. Il cliente
-- la compila dalla sua area portale; l'agenzia la legge dal cockpit.
CREATE TABLE IF NOT EXISTS client_website_briefs (
  id            serial PRIMARY KEY,
  client_id     integer NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  parsed_json   text NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_website_briefs_client
  ON client_website_briefs (client_id);

-- Convenzione di progetto: RLS attiva e ZERO policy — l'API accede col ruolo
-- postgres e fa da sola i controlli per cliente (scoping via share_token nel
-- portale, getAccessibleClientIds nel cockpit). client_notes è l'eccezione
-- storica da non imitare.
ALTER TABLE client_website_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_website_briefs all authenticated" ON client_website_briefs;

COMMENT ON TABLE client_website_briefs IS
  'Brief di discovery del SITO WEB (distinto dal brief social in client_briefs). Una riga per cliente.';
