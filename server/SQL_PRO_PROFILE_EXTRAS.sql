-- Extra Pro profile fields (Postgres)
-- Safe to rerun.

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS instagram text;

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS whatsapp text;

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS website text;






