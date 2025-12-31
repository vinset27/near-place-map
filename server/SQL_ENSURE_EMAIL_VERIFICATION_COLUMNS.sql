-- Ensure email verification columns exist (compatible with older DBs)
-- Run this once if your DB schema predates the email verification feature.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz;


