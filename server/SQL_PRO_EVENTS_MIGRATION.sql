-- Near-Place / O'Show
-- Pro + Events schema migration (Postgres)
-- Safe to run multiple times (uses IF NOT EXISTS / defensive DO $$ blocks).

-- 1) business_applications: link to owner user (who submitted)
ALTER TABLE business_applications
  ADD COLUMN IF NOT EXISTS user_id varchar;

-- 2) establishment_profiles: add avatar
ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 3) establishments: owner user linkage
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS owner_user_id varchar;

-- 4) events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id varchar NOT NULL,
  establishment_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'event',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  description text,
  cover_url text,
  photos text[],
  published boolean NOT NULL DEFAULT true
);

-- 5) useful indexes
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS events_establishment_id_idx ON events (establishment_id);
CREATE INDEX IF NOT EXISTS events_user_id_idx ON events (user_id);

-- 6) optional foreign keys (only if you want strict referential integrity)
-- These blocks avoid errors if constraints already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_user_id_fk') THEN
    ALTER TABLE events
      ADD CONSTRAINT events_user_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_establishment_id_fk') THEN
    ALTER TABLE events
      ADD CONSTRAINT events_establishment_id_fk
      FOREIGN KEY (establishment_id) REFERENCES establishments(id)
      ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_applications_user_id_fk') THEN
    ALTER TABLE business_applications
      ADD CONSTRAINT business_applications_user_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'establishments_owner_user_id_fk') THEN
    ALTER TABLE establishments
      ADD CONSTRAINT establishments_owner_user_id_fk
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END$$;




