-- Analytics: establishment views (Postgres)
-- Safe to rerun.

CREATE TABLE IF NOT EXISTS establishment_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  establishment_id uuid NOT NULL,
  viewer_user_id varchar,
  anon_id text,
  source text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS establishment_views_establishment_id_idx ON establishment_views (establishment_id);
CREATE INDEX IF NOT EXISTS establishment_views_created_at_idx ON establishment_views (created_at);
CREATE INDEX IF NOT EXISTS establishment_views_viewer_user_id_idx ON establishment_views (viewer_user_id);
CREATE INDEX IF NOT EXISTS establishment_views_anon_id_idx ON establishment_views (anon_id);






