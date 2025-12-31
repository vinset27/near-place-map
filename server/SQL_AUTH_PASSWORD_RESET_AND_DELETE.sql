-- Auth: password reset + account deletion columns (Postgres)
-- Safe to rerun.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_code text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_sent_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;



