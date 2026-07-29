-- Wave DB — foto di copertina del portale cliente (per il redesign "app").
--
-- Una sola immagine per cliente: la cover/hero del portale. Data URL base64
-- (JPEG downscalata a 1200px) in colonna TEXT, come già il logo. NULL = usa il
-- fallback a gradiente col colore del brand.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN clients.cover_url IS
  'Foto di copertina/hero del portale cliente (data URL base64). NULL = fallback gradiente.';
