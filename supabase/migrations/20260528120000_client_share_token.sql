-- Link di condivisione col cliente (accesso senza login a poche sezioni:
-- brief compilabile + consultazione eventi/editoriale/report/file).
-- Il token è un valore casuale non indovinabile; unique per lookup/revoca.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS clients_share_token_uq
  ON public.clients(share_token)
  WHERE share_token IS NOT NULL;
