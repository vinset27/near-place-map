-- Email verification support (Postgres)
-- Run once on your production DB (safe to rerun).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx ON users (email);






