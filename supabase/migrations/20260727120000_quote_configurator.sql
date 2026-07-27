-- Wave CT — configuratore preventivo self-service per potenziali clienti.
--
-- Il prospect apre un link personale, compone il suo pacchetto scegliendo i
-- servizi, vede il totale con lo sconto bundle, e può bloccare la data pagando
-- il primo mese. Ogni preventivo composto resta salvato come lead.
--
-- Quattro tabelle:
--   quote_services       il catalogo (menu di servizi con prezzi e opzioni)
--   quote_discount_codes i codici sconto
--   quote_links          i link personali generati per ogni prospect (token)
--   quote_requests       i preventivi composti = i lead

CREATE TABLE IF NOT EXISTS quote_services (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Servizi',
  -- 'monthly' = ricorrente (moltiplicato per i mesi). 'oneoff' = una tantum.
  billing text NOT NULL DEFAULT 'monthly',
  -- 'fixed' = prezzo unico. 'tiered' = scaglioni. 'per_unit' = prezzo per unità.
  pricing text NOT NULL DEFAULT 'fixed',
  base_price integer NOT NULL DEFAULT 0,
  unit_label text,
  unit_price integer,
  min_qty integer NOT NULL DEFAULT 0,
  max_qty integer NOT NULL DEFAULT 20,
  -- [{ "label": "8 contenuti", "value": "8", "price": 490 }]
  tiers jsonb NOT NULL DEFAULT '[]',
  -- opzioni informative (non cambiano il prezzo): [{ "label":"Canali", "choices":[...] }]
  options jsonb NOT NULL DEFAULT '[]',
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_services_billing_check') THEN
    ALTER TABLE quote_services ADD CONSTRAINT quote_services_billing_check
      CHECK (billing IN ('monthly','oneoff'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_services_pricing_check') THEN
    ALTER TABLE quote_services ADD CONSTRAINT quote_services_pricing_check
      CHECK (pricing IN ('fixed','tiered','per_unit'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS quote_discount_codes (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  percent integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_discount_codes_percent_check') THEN
    ALTER TABLE quote_discount_codes ADD CONSTRAINT quote_discount_codes_percent_check
      CHECK (percent BETWEEN 0 AND 90);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS quote_links (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  prospect_name text NOT NULL,
  note text,
  -- chiavi servizi pre-selezionate quando il prospect apre il link
  preset jsonb NOT NULL DEFAULT '[]',
  created_by text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_requests (
  id serial PRIMARY KEY,
  link_token text,
  prospect_name text,
  email text,
  phone text,
  -- il preventivo composto: [{ "key":"gestione_social", "tier":"12", "qty":null }]
  selection jsonb NOT NULL DEFAULT '[]',
  months integer NOT NULL DEFAULT 4,
  monthly_subtotal integer NOT NULL DEFAULT 0,
  oneoff_subtotal integer NOT NULL DEFAULT 0,
  discount_pct integer NOT NULL DEFAULT 0,
  discount_code text,
  contract_total integer NOT NULL DEFAULT 0,
  deposit integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'composed',
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_requests_token_idx ON quote_requests (link_token);
CREATE INDEX IF NOT EXISTS quote_requests_created_idx ON quote_requests (created_at DESC);

-- Convenzione di progetto: RLS attiva e ZERO policy. L'API accede col ruolo
-- postgres e fa da sola i controlli. quote_services e quote_discount_codes sono
-- lette anche dalle route pubbliche, ma sempre tramite l'API, mai dal browser.
ALTER TABLE quote_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- ─── SEED CATALOGO ────────────────────────────────────────────────────────────
-- Prezzi di partenza basati sulla ricerca di mercato agenzie social Italia 2026
-- (fascia media PMI). Da limare con i prezzi reali di Be Kind.
INSERT INTO quote_services (key, name, description, category, billing, pricing, base_price, unit_label, unit_price, min_qty, max_qty, tiers, options, sort) VALUES
  ('gestione_social', 'Gestione social', 'Piano editoriale, copy, grafiche e pubblicazione sui canali scelti.', 'Gestione', 'monthly', 'tiered', 0, NULL, NULL, 0, 0,
    '[{"label":"8 contenuti / mese","value":"8","price":490},{"label":"12 contenuti / mese","value":"12","price":690},{"label":"16 contenuti / mese","value":"16","price":950}]',
    '[{"label":"Canali inclusi","key":"canali","multi":true,"choices":["Instagram","Facebook","TikTok","LinkedIn"]}]', 1),
  ('reel_video', 'Reel & video editing', 'Montaggio e post-produzione di reel/video verticali.', 'Contenuti', 'monthly', 'tiered', 0, NULL, NULL, 0, 0,
    '[{"label":"4 reel / mese","value":"4","price":290},{"label":"8 reel / mese","value":"8","price":520},{"label":"12 reel / mese","value":"12","price":720}]',
    '[]', 2),
  ('piano_editoriale', 'Piano editoriale strategico', 'Strategia mensile dei contenuti, temi e calendario.', 'Gestione', 'monthly', 'fixed', 250, NULL, NULL, 0, 0, '[]', '[]', 3),
  ('community_mgmt', 'Community management', 'Risposte a commenti e messaggi diretti, moderazione.', 'Gestione', 'monthly', 'fixed', 220, NULL, NULL, 0, 0, '[]', '[]', 4),
  ('adv_meta', 'Campagne Meta Ads', 'Gestione campagne Facebook/Instagram. Budget pubblicitario escluso.', 'Advertising', 'monthly', 'fixed', 350, NULL, NULL, 0, 0, '[]',
    '[{"label":"Obiettivi","key":"obiettivi","multi":true,"choices":["Notorietà","Traffico","Contatti","Vendite"]}]', 5),
  ('adv_google', 'Campagne Google Ads', 'Gestione campagne su rete di ricerca e display. Budget escluso.', 'Advertising', 'monthly', 'fixed', 350, NULL, NULL, 0, 0, '[]',
    '[{"label":"Tipo","key":"tipo","multi":true,"choices":["Ricerca","Display","Performance Max","Shopping"]}]', 6),
  ('email_marketing', 'Email marketing / newsletter', 'Creazione e invio di newsletter e automazioni email.', 'Advertising', 'monthly', 'fixed', 200, NULL, NULL, 0, 0, '[]', '[]', 7),
  ('report_analytics', 'Report & analytics', 'Report mensile con metriche, insight e prossimi passi.', 'Gestione', 'monthly', 'fixed', 150, NULL, NULL, 0, 0, '[]', '[]', 8),
  ('grafiche_extra', 'Grafiche extra', 'Caroselli, stories o grafiche aggiuntive oltre il pacchetto.', 'Contenuti', 'monthly', 'per_unit', 0, 'grafica', 35, 0, 20, '[]', '[]', 9),
  ('shooting', 'Shooting foto/video', 'Servizio fotografico o video in sede o in esterna.', 'Una tantum', 'oneoff', 'tiered', 0, NULL, NULL, 0, 0,
    '[{"label":"Mezza giornata","value":"mezza","price":350},{"label":"Giornata intera","value":"intera","price":600}]', '[]', 10),
  ('setup_profili', 'Setup & ottimizzazione profili', 'Creazione o revisione completa dei profili social.', 'Una tantum', 'oneoff', 'fixed', 250, NULL, NULL, 0, 0, '[]', '[]', 11),
  ('branding', 'Logo & brand identity', 'Logo, palette, font e mini linee guida del brand.', 'Una tantum', 'oneoff', 'fixed', 800, NULL, NULL, 0, 0, '[]', '[]', 12),
  ('landing', 'Landing page / mini sito', 'Pagina di atterraggio o mini sito one-page.', 'Una tantum', 'oneoff', 'fixed', 900, NULL, NULL, 0, 0, '[]', '[]', 13)
ON CONFLICT (key) DO NOTHING;

-- Un codice sconto d'esempio, disattivabile.
INSERT INTO quote_discount_codes (code, percent, active, note) VALUES
  ('PARTENZA2026', 10, true, 'Codice lancio - primo contatto')
ON CONFLICT (code) DO NOTHING;
