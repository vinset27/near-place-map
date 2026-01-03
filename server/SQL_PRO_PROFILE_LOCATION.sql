-- Pro profile: store precise location (Postgres)
-- Safe to rerun.

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS lat double precision;

ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS lng double precision;






