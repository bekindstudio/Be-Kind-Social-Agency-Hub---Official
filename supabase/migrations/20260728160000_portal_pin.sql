-- Wave CY — PIN opzionale sul portale cliente + PWA per-cliente.
--
-- Il portale resta ad accesso via link (il token è la chiave), ma ora si può
-- aggiungere un PIN a 4-6 cifre come seconda chiave leggera, così una volta
-- installato come app resta protetto. NULL = nessun PIN, portale aperto come
-- prima. L'hash è HMAC col segreto del server, non il PIN in chiaro.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_pin_hash text;

COMMENT ON COLUMN clients.portal_pin_hash IS
  'Hash HMAC del PIN portale (NULL = nessun PIN). Il PIN non è mai salvato in chiaro.';
