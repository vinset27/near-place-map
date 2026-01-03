-- NearPlace / O'Show
-- User events (meetups/parties) + moderation defaults
-- Run this once on your Postgres (Neon/Render/etc).

-- 1) Create user_events table (public content created by users)
CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id varchar NOT NULL,
  kind text NOT NULL DEFAULT 'party', -- 'party' | 'meet'
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  description text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  -- moderation gate: only admin can publish
  published boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS user_events_starts_at_idx ON user_events (starts_at);
CREATE INDEX IF NOT EXISTS user_events_user_id_idx ON user_events (user_id);
CREATE INDEX IF NOT EXISTS user_events_lat_lng_idx ON user_events (lat, lng);

-- 2) Moderation: by default, new Pro events should also be pending
ALTER TABLE events
  ALTER COLUMN published SET DEFAULT false;

-- If user_events existed with default true (older deployment), force default false:
ALTER TABLE user_events
  ALTER COLUMN published SET DEFAULT false;

-- Optional (DO NOT run if you want to keep current public content):
-- UPDATE events SET published = false WHERE published = true;
-- UPDATE user_events SET published = false WHERE published = true;





