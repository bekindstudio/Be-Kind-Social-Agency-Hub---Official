-- Wave CX — prezzi su misura per ogni cliente, salvati sul suo link.
--
-- Finora il catalogo aveva prezzi globali uguali per tutti. Ora ogni link
-- prospect può avere i propri override: si personalizzano i prezzi per quel
-- cliente, si salvano, e poi si manda il link. Dove non c'è override, vale il
-- prezzo del catalogo globale.
--
-- Forma: { "<serviceKey>": { "basePrice": 690, "unitPrice": 40,
--                            "tiers": { "12": 640 }, "hidden": false } }
ALTER TABLE quote_links
  ADD COLUMN IF NOT EXISTS price_overrides jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN quote_links.price_overrides IS
  'Override di prezzo per questo cliente, per chiave servizio. {} = usa i prezzi globali del catalogo.';
