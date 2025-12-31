-- Pro profile: owner first/last name (Postgres)
-- Safe to rerun.

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS owner_first_name text;

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS owner_last_name text;



