-- Wave CS — lo script del contenuto trova finalmente una casa.
--
-- Fino a oggi gli script dei video (il parlato: cosa si dice a camera) vivevano
-- solo nei PDF e nelle chat. Nel database esisteva `caption` — che è il testo
-- del post, un'altra cosa — e nient'altro. Risultato: lo script non era
-- collegato al contenuto che descrive, non era ricercabile e il cliente non
-- poteva vederlo.
--
-- Sta su editorial_slots e non su una tabella a parte perché la domanda è
-- sempre "lo script DI QUALE contenuto?".
ALTER TABLE editorial_slots
  ADD COLUMN IF NOT EXISTS script text;

COMMENT ON COLUMN editorial_slots.script IS
  'Il parlato del video: dialoghi, battute, indicazioni di regia. Diverso da caption, che è il testo del post pubblicato.';
