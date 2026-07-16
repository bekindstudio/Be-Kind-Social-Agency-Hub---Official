-- Be Kind HUB · Migration: categoria contenuto sulle idee (educativo/informativo/…)
-- Da applicare su Supabase: SQL Editor → incolla → Run. Idempotente.

-- Le idee già in banca restano valide: entrano come 'da_classificare'.
-- La categoria è facoltativa di proposito — si deve poter buttare dentro un
-- link al volo senza scegliere niente, e classificarlo dopo.
ALTER TABLE client_content_ideas
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'da_classificare';

-- Come per status/source: la validazione vera è Zod nella route, il CHECK
-- difende solo da insert diretti (SQL Editor / script).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_content_ideas_category_check') THEN
    ALTER TABLE client_content_ideas
      ADD CONSTRAINT client_content_ideas_category_check
      CHECK (category IN (
        'da_classificare',
        'educativo',
        'informativo',
        'divertente',
        'vendita',
        'ispirazionale',
        'dietro_le_quinte'
      ));
  END IF;
END $$;

-- Nessun index su category: si filtra sempre DENTRO le idee di un cliente già
-- caricate (poche decine), e l'index (client_id, created_at DESC) esistente
-- copre già la query principale. Un index qui costerebbe scritture senza
-- servire a nessuna query.
